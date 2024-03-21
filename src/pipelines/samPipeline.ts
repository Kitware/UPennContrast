import {
  IErrorToolState,
  IGeoJSAnnotation,
  IGeoJSPoint,
  IGeoJSPolygonFeatureStyle,
  IMapEntry,
  IMouseState,
  ISamAnnotationToolState,
  IToolConfiguration,
  PromptType,
  TSamPrompt,
} from "@/store/model";
import {
  ManualInputNode,
  NoOutput,
  TNoOutput,
  createComputeNode,
} from "./computePipeline";
import { createOnnxInferenceSession } from "./onnxModels";
import { InferenceSession, Tensor, TypedTensor } from "onnxruntime-web/webgpu";
import geojs from "geojs";
import {
  BinaryFile,
  InterfaceTypes,
  PipelineInput,
  PipelineOutput,
  TextFile,
  runPipeline,
} from "itk-wasm";
// Import Vue to set reactively the output of the state
import { Vue } from "vue-property-decorator";

type TensorF32 = TypedTensor<"float32">;

interface ISamConfiguration {
  maxWidth: number;
  maxHeight: number;
  meanPerChannel: [number, number, number];
  stdPerChannel: [number, number, number];
}

interface ISamEncoderContext {
  configuration: ISamConfiguration;
  canvas: HTMLCanvasElement; // Keep this canvas at the encoder input dimensions
  context: CanvasRenderingContext2D; // The corresponding context
  buffer: Float32Array;
}

interface ISamDecoderContext {
  feedConstant: {
    mask_input: TensorF32;
    has_mask_input: TensorF32;
  };
}

const samModelsConfig = {
  vit_b: {
    maxWidth: 1024,
    maxHeight: 1024,
    meanPerChannel: [123.675, 116.28, 103.53],
    stdPerChannel: [58.395, 57.12, 57.375],
  },
} satisfies Record<string, ISamConfiguration>;

export type TSamModel = keyof typeof samModelsConfig;

function createEncoderContext(model: TSamModel): ISamEncoderContext {
  const configuration = samModelsConfig[model];
  const { maxWidth, maxHeight } = configuration;
  const canvas = document.createElement("canvas");
  canvas.width = maxWidth;
  canvas.height = maxHeight;
  const context = canvas.getContext("2d", {
    alpha: false,
    colorSpace: "srgb",
    willReadFrequently: true,
  });
  if (!context) {
    throw new Error("Can't create encoder context");
  }
  const nPixels = maxWidth * maxHeight;
  const nChannels = 3;
  const buffer = new Float32Array(nPixels * nChannels);
  return {
    configuration,
    buffer,
    canvas,
    context,
  };
}

function createDecoderContext(): ISamDecoderContext {
  return {
    feedConstant: {
      has_mask_input: new Tensor("float32", [0]),
      mask_input: new Tensor(
        "float32",
        new Float32Array(256 * 256),
        [1, 1, 256, 256],
      ),
    },
  };
}

async function screenshot({ map, imageLayers }: IMapEntry) {
  const layers = imageLayers.filter(
    (layer) => layer.node().css("visibility") !== "hidden",
  );
  const imageCanvas = await map.screenshot(layers, "canvas");
  return imageCanvas;
}

interface IProcessCanvasOutput {
  encoderFeed: { input_image: TensorF32 };
  scaledWidth: number;
  scaledHeight: number;
  srcWidth: number;
  srcHeight: number;
}

function processCanvas(
  srcCanvas: HTMLCanvasElement,
  samContext: ISamEncoderContext,
): IProcessCanvasOutput {
  // Extract all values from the samContext
  // The context comes from a canvas of size: width * height
  // The buffer is of size: width * height * 3
  const {
    configuration: { maxWidth, maxHeight, meanPerChannel, stdPerChannel },
    context,
    buffer,
  } = samContext;

  const srcWidth = srcCanvas.width;
  const srcHeight = srcCanvas.height;
  let scaledWidth: number;
  let scaledHeight: number;
  // Equivalent to (maxWidth / srcWidth < maxHeight / srcHeight): choose the smallest scale factor
  // Equivalent to (srcWidth / maxWidth > srcHeight / maxHeight): choose the biggest relative side
  if (srcWidth * maxHeight > srcHeight * maxWidth) {
    const scale = maxWidth / srcWidth; // < maxHeight / srcHeight
    scaledWidth = maxWidth; // = srcWidth * scale
    scaledHeight = Math.round(srcHeight * scale); // < maxHeight
  } else {
    const scale = maxHeight / srcHeight; // <= maxWidth / srcWidth
    scaledWidth = Math.round(srcWidth * scale); // <= maxWidth
    scaledHeight = maxHeight; // = srcHeight * scale
  }

  // Draw the input image
  context.clearRect(0, 0, maxWidth, maxHeight);
  context.drawImage(srcCanvas, 0, 0, scaledWidth, scaledHeight);

  // Convert image to normalized float32 buffer
  const imageData = context.getImageData(0, 0, maxWidth, maxHeight);
  const rgbaBuffer = imageData.data;
  const nPixels = maxWidth * maxHeight;
  for (let channel = 0; channel < 3; ++channel) {
    const channelOffset = channel * nPixels;
    const mean = meanPerChannel[channel];
    const std = stdPerChannel[channel];
    for (let iPixel = 0; iPixel < nPixels; ++iPixel) {
      buffer[channelOffset + iPixel] =
        (rgbaBuffer[iPixel * 4 + channel] - mean) / std;
    }
  }

  return {
    encoderFeed: {
      input_image: new Tensor("float32", buffer, [1, 3, maxHeight, maxWidth]),
    },
    srcWidth,
    srcHeight,
    scaledWidth,
    scaledHeight,
  };
}

interface IEncoderOutput {
  image_embeddings: TensorF32;
}

async function runEncoder(
  encoderSession: InferenceSession,
  input: IProcessCanvasOutput,
) {
  const encoderOutput = await encoderSession.run(input.encoderFeed);
  return encoderOutput as unknown as IEncoderOutput;
}

interface IProcessPromptOutput {
  point_coords: TensorF32;
  point_labels: TensorF32;
  orig_im_size: TensorF32;
  mask_input: TensorF32;
  has_mask_input: TensorF32;
}

function processPrompt(
  prompts: TSamPrompt[],
  canvasInfo: IProcessCanvasOutput,
  context: ISamDecoderContext,
  { map }: IMapEntry,
): IProcessPromptOutput {
  // Count the number of each prompt type
  let nForegroundPts = 0;
  let nBackgroundPts = 0;
  let nBoxes = 0;
  for (let i = 0; i < prompts.length; ++i) {
    switch (prompts[i].type) {
      case PromptType.backgroundPoint:
        nBackgroundPts++;
        break;
      case PromptType.foregroundPoint:
        nForegroundPts++;
        break;
      case PromptType.box:
        nBoxes++;
        break;
    }
  }

  // Number of gcs points (to convert) + a padding point (not to convert)
  const nPromptPoints = nForegroundPts + nBackgroundPts + (2 * nBoxes || 1);
  const pointCoords = new Float32Array(2 * nPromptPoints);
  const pointLabels = new Float32Array(nPromptPoints);

  // Create a function to add a point to the array, along with its label
  let pointIdx = 0;
  const xScale = canvasInfo.scaledWidth / canvasInfo.srcWidth;
  const yScale = canvasInfo.scaledHeight / canvasInfo.srcHeight;
  const pushPointToPrompt = (
    point: IGeoJSPoint,
    label: number,
    convertFromGcs: boolean,
  ) => {
    let promptPoint = point;
    if (convertFromGcs) {
      // Gcs coordinates -> Display / Source coordinates
      promptPoint = map.gcsToDisplay(promptPoint);
      // Display / Source coordinates -> Scaled coordinates
      promptPoint.x *= xScale;
      promptPoint.y *= yScale;
    }
    pointCoords[2 * pointIdx + 0] = promptPoint.x;
    pointCoords[2 * pointIdx + 1] = promptPoint.y;
    pointLabels[pointIdx] = label;
    pointIdx++;
  };

  // Add all the prompts to the arrays
  for (let i = 0; i < prompts.length; ++i) {
    const prompt = prompts[i];
    switch (prompt.type) {
      case PromptType.backgroundPoint:
        pushPointToPrompt(prompt.point, 0, true);
        break;
      case PromptType.foregroundPoint:
        pushPointToPrompt(prompt.point, 1, true);
        break;
      case PromptType.box:
        pushPointToPrompt(prompt.topLeft, 2, true);
        pushPointToPrompt(prompt.bottomRight, 3, true);
        break;
    }
  }

  // Padding point
  if (nBoxes === 0) {
    pushPointToPrompt({ x: 0, y: 0 }, -1, false);
  }

  return {
    point_coords: new Tensor("float32", pointCoords, [1, nPromptPoints, 2]),
    point_labels: new Tensor("float32", pointLabels, [1, nPromptPoints]),
    orig_im_size: new Tensor("float32", [
      canvasInfo.srcHeight,
      canvasInfo.srcWidth,
    ]),
    ...context.feedConstant,
  };
}

interface IDecoderOutput {
  masks: TensorF32;
  low_res_masks: TensorF32;
  iou_predictions: TensorF32;
}

async function runDecoder(
  decoderSession: InferenceSession,
  prompt: IProcessPromptOutput,
  encoderOutput: IEncoderOutput,
) {
  const decoderOutput = await decoderSession.run({
    ...encoderOutput,
    ...prompt,
  });
  return decoderOutput as unknown as IDecoderOutput;
}

interface IItkOutput {
  contour: IGeoJSPoint[];
}

async function runItkPipeline({ masks }: IDecoderOutput): Promise<IItkOutput> {
  const array = masks.data;
  const width = masks.dims[3];
  const height = masks.dims[2];

  // Setup input image
  const imagePath = "./inimage.bin";
  const imageFile: BinaryFile = {
    data: new Uint8Array(array.buffer),
    path: imagePath,
  };
  const imageInput: PipelineInput = {
    data: imageFile,
    type: InterfaceTypes.BinaryFile,
  };

  // Setup output json
  const outPath = "./out.json";
  const jsonOutput: PipelineOutput = {
    data: { path: outPath },
    type: InterfaceTypes.TextFile,
  };

  // Run the pipeline
  const pipelineName = "MaskToBlob";
  const pipelineArgs: string[] = [
    imagePath,
    width.toString(),
    height.toString(),
    outPath,
  ];
  const pipelineInputs: PipelineInput[] = [imageInput];
  const pipelineOutputs: PipelineOutput[] = [jsonOutput];
  const { outputs, webWorker } = await runPipeline(
    pipelineName,
    pipelineArgs,
    pipelineOutputs,
    pipelineInputs,
  );

  // Parse the output
  try {
    const textFile = outputs[0]?.data as TextFile | undefined;
    if (!textFile?.data) {
      throw new Error("Pipeline didn't return a value");
    }
    return JSON.parse(textFile.data);
  } finally {
    webWorker?.terminate();
  }
}

function itkContourToAnnotationCoordinates(
  { contour }: IItkOutput,
  { map }: IMapEntry,
): IGeoJSPoint[] {
  return map.displayToGcs(contour);
}

function createSamPipeline(
  model: TSamModel,
): ISamAnnotationToolState["pipeline"] {
  if (!("gpu" in navigator)) {
    throw new Error("Can't initialize SAM tool: WebGPU not available");
  }
  // Create the encoder context
  const encoderContext = createEncoderContext(model);

  // Create the pipeline

  // Encoder nodes
  const geoJsMapInputNode = new ManualInputNode<IMapEntry | TNoOutput>({
    type: "debounce",
    wait: 1000,
    options: { leading: false, trailing: true },
  }); // User input
  const encoderContextNode = new ManualInputNode<ISamEncoderContext>();
  const encoderSessionNode = new ManualInputNode<InferenceSession>();
  const screenshotNode = createComputeNode(screenshot, [geoJsMapInputNode]);
  const encoderPreprocessNode = createComputeNode(processCanvas, [
    screenshotNode,
    encoderContextNode,
  ]);
  const encoderNode = createComputeNode(runEncoder, [
    encoderSessionNode,
    encoderPreprocessNode,
  ]);

  // Decoder nodes
  const promptInputNode = new ManualInputNode<TSamPrompt[] | TNoOutput>(); // User input
  const decoderContextNode = new ManualInputNode<ISamDecoderContext>();
  const decoderSessionNode = new ManualInputNode<InferenceSession>();
  const processPromptNode = createComputeNode(processPrompt, [
    promptInputNode,
    encoderPreprocessNode,
    decoderContextNode,
    geoJsMapInputNode,
  ]);
  const decoderNode = createComputeNode(runDecoder, [
    decoderSessionNode,
    processPromptNode,
    encoderNode,
  ]);

  // Conversion to contour
  const itkOutputNode = createComputeNode(runItkPipeline, [decoderNode]);
  const pipelineOutput = createComputeNode(itkContourToAnnotationCoordinates, [
    itkOutputNode,
    geoJsMapInputNode,
  ]);

  // Set the constant context
  encoderContextNode.setValue(encoderContext);
  const decoderContext = createDecoderContext();
  decoderContextNode.setValue(decoderContext);

  // Set the encoder
  const encoderPath = `/onnx-models/sam/${model}/encoder.onnx`;
  const encoderOptions = { executionProviders: ["webgpu"] };
  createOnnxInferenceSession(encoderPath, encoderOptions).then((session) => {
    encoderSessionNode.setValue(session);
  });

  // Set the decoder
  const decoderPath = `/onnx-models/sam/${model}/decoder.onnx`;
  const decoderOptions = {};
  createOnnxInferenceSession(decoderPath, decoderOptions).then((session) => {
    decoderSessionNode.setValue(session);
  });

  return { geoJsMapInputNode, promptInputNode, pipelineOutput };
}

export function createSamToolStateFromToolConfiguration(
  configuration: IToolConfiguration<"samAnnotation">,
): ISamAnnotationToolState | IErrorToolState {
  const model: TSamModel = configuration.values.model.value;
  let pipeline: ISamAnnotationToolState["pipeline"];
  try {
    pipeline = createSamPipeline(model);
  } catch (error) {
    return { error: error as Error };
  }
  const state: ISamAnnotationToolState = {
    pipeline,
    mouseState: {
      path: [],
    },
    output: null,
  };
  const outputNode = state.pipeline.pipelineOutput;
  outputNode.onOutputUpdate(() => {
    const rawOutput = outputNode.output;
    const newOutput =
      !rawOutput || rawOutput === NoOutput || rawOutput.length <= 0
        ? null
        : rawOutput;
    // State is meant to be reactive
    Vue.set(state, "output", newOutput);
  });
  return state;
}

export function mouseStateToSamPrompt(
  mouseState: IMouseState,
): TSamPrompt | null {
  const path = mouseState.path;
  if (path.length === 0) {
    return null;
  }
  const firstPoint = path[0];
  const lastPoint = path[path.length - 1];
  if (firstPoint.x === lastPoint.x && firstPoint.y === lastPoint.y) {
    // Left button pressed: foreground prompt
    // Any other button pressed: background prompt
    const isForeground = mouseState.initialMouseEvent.button === 0;
    if (isForeground) {
      return {
        type: PromptType.foregroundPoint,
        point: firstPoint,
      };
    } else {
      return {
        type: PromptType.backgroundPoint,
        point: firstPoint,
      };
    }
  } else {
    const [{ x: x1, y: y1 }, { x: x2, y: y2 }] = [firstPoint, lastPoint];
    const [minX, maxX] = x1 < x2 ? [x1, x2] : [x2, x1];
    const [minY, maxY] = y1 < y2 ? [y1, y2] : [y2, y1];
    return {
      type: PromptType.box,
      topLeft: { x: minX, y: minY },
      bottomRight: { x: maxX, y: maxY },
    };
  }
}

export function samPromptToAnnotation(
  unitPrompt: TSamPrompt,
  baseStyle: IGeoJSPolygonFeatureStyle,
): IGeoJSAnnotation {
  let strokeColor: string;
  switch (unitPrompt.type) {
    case PromptType.foregroundPoint:
    case PromptType.box:
      strokeColor = "green";
      break;
    case PromptType.backgroundPoint:
      strokeColor = "red";
      break;
  }
  const style = { ...baseStyle, strokeColor };
  if (unitPrompt.type === PromptType.box) {
    const { x: minX, y: minY } = unitPrompt.topLeft;
    const { x: maxX, y: maxY } = unitPrompt.bottomRight;
    const corners = [
      { x: minX, y: minY },
      { x: minX, y: maxY },
      { x: maxX, y: maxY },
      { x: maxX, y: minY },
    ];
    return geojs.annotation.rectangleAnnotation({
      style,
      corners,
    });
  }
  const position = unitPrompt.point;
  return geojs.annotation.pointAnnotation({
    style,
    position,
  });
}
