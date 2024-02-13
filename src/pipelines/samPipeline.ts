import {
  IGeoJSMap,
  IGeoJSPoint,
  ISamAnnotationToolState,
  ISamPrompt,
  IToolConfiguration,
} from "@/store/model";
import { ManualInputNode, createComputeNode } from "./computePipeline";
import { createOnnxInferenceSession } from "./onnxModels";
import { InferenceSession, Tensor } from "onnxruntime-web/webgpu";

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
    mask_input: Tensor;
    has_mask_input: Tensor;
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

function createEncoderContext(model: TSamModel): ISamEncoderContext | null {
  console.log("createSamContext", model);
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
    return null;
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

async function screenshot(map: IGeoJSMap) {
  console.log("screenshot", map);
  // TODO: only screenshot needed layers (no annotation, no text)
  const layers = map
    .layers()
    .filter((layer) => layer.node().css("visibility") !== "hidden");
  const imageCanvas = await map.screenshot(layers, "canvas");
  return imageCanvas;
}

interface IProcessCanvasOutput {
  encoderFeed: { input_image: Tensor };
  scaledWidth: number;
  scaledHeight: number;
  srcWidth: number;
  srcHeight: number;
}

function processCanvas(
  srcCanvas: HTMLCanvasElement,
  samContext: ISamEncoderContext,
): IProcessCanvasOutput {
  console.log("processCanvas", srcCanvas, samContext);
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

interface IDecoderOutput {
  image_embeddings: Tensor;
}

async function runEncoder(
  encoderSession: InferenceSession,
  input: IProcessCanvasOutput,
) {
  console.log("runEncoder", encoderSession, input);
  const encoderOutput = await encoderSession.run(input.encoderFeed);
  return encoderOutput as unknown as IDecoderOutput;
}

interface IProcessPromptOutput {
  point_coords: Tensor;
  point_labels: Tensor;
  orig_im_size: Tensor;
  mask_input: Tensor;
  has_mask_input: Tensor;
}

function processPrompt(
  prompt: ISamPrompt,
  canvasInfo: IProcessCanvasOutput,
  context: ISamDecoderContext,
  map: IGeoJSMap,
): IProcessPromptOutput {
  console.log("processPrompt", prompt, canvasInfo, context);
  const { foregroundPoints, backgroundPoints, boxes } = prompt;

  // Number of gcs points (to convert) + a padding point (not to convert)
  const nPromptPoints =
    foregroundPoints.length + backgroundPoints.length + (2 * boxes.length || 1);

  const pointCoords = new Float32Array(2 * nPromptPoints);
  const pointLabels = new Float32Array(nPromptPoints);

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

  for (let i = 0; i < backgroundPoints.length; ++i) {
    pushPointToPrompt(backgroundPoints[i], 0, true);
  }
  for (let i = 0; i < foregroundPoints.length; ++i) {
    pushPointToPrompt(foregroundPoints[i], 1, true);
  }
  for (let i = 0; i < boxes.length; ++i) {
    const [{ x: x1, y: y1 }, { x: x2, y: y2 }] = boxes[i];
    const [minX, maxX] = x1 < x2 ? [x1, x2] : [x2, x1];
    const [minY, maxY] = y1 < y2 ? [y1, y2] : [y2, y1];
    pushPointToPrompt({ x: minX, y: minY }, 2, true);
    pushPointToPrompt({ x: maxX, y: maxY }, 3, true);
  }
  if (boxes.length === 0) {
    // Padding point
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

async function runDecoder(
  decoderSession: InferenceSession,
  prompt: IProcessPromptOutput,
  encoderOutput: IDecoderOutput,
) {
  console.log("runDecoder", decoderSession, prompt, encoderOutput);
  const decoderOutput = await decoderSession.run({
    ...encoderOutput,
    ...prompt,
  });
  return decoderOutput;
}

function createSamPipeline(
  model: TSamModel,
): ISamAnnotationToolState["pipeline"] {
  // Create the encoder context
  const encoderContext = createEncoderContext(model);
  if (encoderContext === null) {
    return null;
  }

  // Create the pipeline

  // Encoder nodes
  const geoJsMapInputNode = new ManualInputNode<IGeoJSMap>(); // User input
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
  const promptInputNode = new ManualInputNode<ISamPrompt>(); // User input
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

  // TODO: currently prints the output
  // ----------------------------------------------------------------
  function arrayToImageData(input: any, width: number, height: number) {
    const [r, g, b, a] = [0, 114, 189, 255]; // the masks's blue color
    const arr = new Uint8ClampedArray(4 * width * height).fill(0);
    for (let i = 0; i < input.length; i++) {
      // Threshold the onnx model mask prediction at 0.0
      // This is equivalent to thresholding the mask using predictor.model.mask_threshold
      // in python
      if (input[i] > 0.0) {
        arr[4 * i + 0] = r;
        arr[4 * i + 1] = g;
        arr[4 * i + 2] = b;
        arr[4 * i + 3] = a;
      }
    }
    return new ImageData(arr, height, width);
  }

  // Use a Canvas element to produce an image from ImageData
  function imageDataToImage(imageData: ImageData) {
    const canvas = imageDataToCanvas(imageData);
    const image = new Image();
    image.src = canvas.toDataURL();
    return image;
  }

  // Canvas elements can be created from ImageData
  function imageDataToCanvas(imageData: ImageData) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx?.putImageData(imageData, 0, 0);
    return canvas;
  }

  // Convert the onnx model mask output to an HTMLImageElement
  function onnxMaskToImage(input: any, width: number, height: number) {
    return imageDataToImage(arrayToImageData(input, width, height));
  }

  function printDataString(decoderOutput: any) {
    console.log(
      "printDataString",
      onnxMaskToImage(
        decoderOutput.masks.data,
        decoderOutput.masks.dims[2],
        decoderOutput.masks.dims[3],
      ).src,
    );
  }
  createComputeNode(printDataString, [decoderNode]);
  // ----------------------------------------------------------------

  // Set the constant context
  encoderContextNode.setValue(encoderContext);
  const decoderContext = createDecoderContext();
  decoderContextNode.setValue(decoderContext);

  // Set the encoder
  const encoderPath = `/onnx-models/sam/${model}/encoder.onnx`;
  const encoderOptions = { executionProviders: ["webgpu"] };
  createOnnxInferenceSession(encoderPath, encoderOptions).then((session) => {
    encoderSessionNode.setValue(session);
    console.log("Encoder session node set");
  });

  // Set the decoder
  const decoderPath = `/onnx-models/sam/${model}/decoder.onnx`;
  const decoderOptions = {};
  createOnnxInferenceSession(decoderPath, decoderOptions).then((session) => {
    decoderSessionNode.setValue(session);
    console.log("Decoder session node set");
  });

  return { geoJsMapInputNode, promptInputNode };
}

export function createSamToolStateFromToolConfiguration(
  configuration: IToolConfiguration<"samAnnotation">,
) {
  const model: TSamModel = configuration.values.model.value;
  const state: ISamAnnotationToolState = {
    pipeline: createSamPipeline(model),
    currentPrompt: {
      foregroundPoints: [],
      backgroundPoints: [],
      boxes: [],
    },
    mouseState: {
      path: [],
    },
  };
  return state;
}
