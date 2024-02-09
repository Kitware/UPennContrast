import {
  IGeoJSMap,
  ISamAnnotationToolState,
  IToolConfiguration,
} from "@/store/model";
import {
  ManualInputNode,
  ManualOutputNode,
  createComputeNode,
} from "./computePipeline";
import { createOnnxInferenceSession } from "./onnxModels";
import { InferenceSession, Tensor } from "onnxruntime-web/webgpu";

interface ISamConfiguration {
  width: number;
  height: number;
  meanPerChannel: [number, number, number];
  stdPerChannel: [number, number, number];
}

interface ISamEncoderContext {
  configuration: ISamConfiguration;
  canvas: HTMLCanvasElement; // Keep this canvas at the encoder input dimensions
  context: CanvasRenderingContext2D; // The corresponding context
  buffer: Float32Array;
}

interface ISamEncoderPreprocessOutput {
  encoderFeed: { input_image: Tensor };
  scaledWidth: number;
  scaledHeight: number;
  srcWidth: number;
  srcHeight: number;
}

const samModelsConfig = {
  vit_b: {
    width: 1024,
    height: 1024,
    meanPerChannel: [123.675, 116.28, 103.53],
    stdPerChannel: [58.395, 57.12, 57.375],
  },
} satisfies Record<string, ISamConfiguration>;

export type TSamModel = keyof typeof samModelsConfig;

function createSamContext(model: TSamModel) {
  console.log("createSamContext");
  const configuration = samModelsConfig[model];
  const { width, height } = configuration;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", {
    alpha: false,
    colorSpace: "srgb",
    willReadFrequently: true,
  });
  if (!context) {
    return null;
  }
  const nPixels = width * height;
  const nChannels = 3;
  const buffer = new Float32Array(nPixels * nChannels);
  return {
    configuration,
    buffer,
    canvas,
    context,
  };
}

async function screenshot(map: IGeoJSMap) {
  console.log("screenshot");
  const layers = map
    .layers()
    .filter((layer) => layer.node().css("visibility") !== "hidden");
  const imageCanvas = await map.screenshot(layers, "canvas");
  return imageCanvas;
}

function encoderPreprocess(
  srcCanvas: HTMLCanvasElement,
  samContext: ISamEncoderContext,
): ISamEncoderPreprocessOutput {
  console.log("encoderPreprocess");
  // Extract all values from the samContext
  // The context comes from a canvas of size: width * height
  // The buffer is of size: width * height * 3
  const {
    configuration: { width, height, meanPerChannel, stdPerChannel },
    context,
    buffer,
  } = samContext;

  const srcWidth = srcCanvas.width;
  const srcHeight = srcCanvas.height;
  let scaledWidth: number;
  let scaledHeight: number;
  // Equivalent to (width / srcWidth < height / srcHeight): choose the smallest scale factor
  // Equivalent to (srcWidth / width > srcHeight / height): choose the biggest relative side
  if (srcWidth * height > srcHeight * width) {
    const scale = width / srcWidth; // < height / srcHeight
    scaledWidth = width; // = srcWidth * scale
    scaledHeight = srcHeight * scale; // < height
  } else {
    const scale = height / srcHeight; // <= width / srcWidth
    scaledWidth = srcWidth * scale; // <= width
    scaledHeight = height; // = srcHeight * scale
  }

  // Draw the input image
  context.clearRect(0, 0, width, height);
  context.drawImage(srcCanvas, 0, 0, scaledWidth, scaledHeight);

  // Convert image to normalized float32 buffer
  const imageData = context.getImageData(0, 0, width, height);
  const rgbaBuffer = imageData.data;
  const nPixels = width * height;
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
      input_image: new Tensor("float32", buffer, [1, 3, height, width]),
    },
    srcWidth,
    srcHeight,
    scaledWidth,
    scaledHeight,
  };
}

async function runEncoder(
  encoderSession: InferenceSession,
  input: ISamEncoderPreprocessOutput,
) {
  console.log("runEncoder");
  const encoderOutput = await encoderSession.run(input.encoderFeed);
  return encoderOutput as { image_embeddings: Tensor };
}

function createSamPipeline(model: TSamModel) {
  // Create the sam context
  const samContext = createSamContext(model);
  if (samContext === null) {
    return null;
  }

  // Create the pipeline
  const geoJsMapInputNode = new ManualInputNode<IGeoJSMap>();
  const pipelineContextNode = new ManualInputNode<ISamEncoderContext>();
  const encoderSessionInputNode = new ManualInputNode<InferenceSession>();
  const decoderSessionInputNode = new ManualInputNode<InferenceSession>();
  const screenshotNode = createComputeNode(screenshot, [geoJsMapInputNode]);
  const encoderPreprocessNode = createComputeNode(encoderPreprocess, [
    screenshotNode,
    pipelineContextNode,
  ]);
  const encoderNode = createComputeNode(runEncoder, [
    encoderSessionInputNode,
    encoderPreprocessNode,
  ]);

  // TODO: currently prints the output of the encoder
  new ManualOutputNode(encoderNode, console.log);

  // Set the constant context
  pipelineContextNode.setOutput(samContext);

  // Set the encoder
  const encoderPath = `/onnx-models/sam/${model}/encoder.onnx`;
  const encoderOptions = { executionProviders: ["webgpu"] };
  createOnnxInferenceSession(encoderPath, encoderOptions).then((session) => {
    encoderSessionInputNode.setOutput(session);
    console.log("Encoder session node set");
  });

  // Set the decoder
  const decoderPath = `/onnx-models/sam/${model}/decoder.onnx`;
  const decoderOptions = {};
  createOnnxInferenceSession(decoderPath, decoderOptions).then((session) => {
    decoderSessionInputNode.setOutput(session);
  });

  return geoJsMapInputNode;
}

export function createSamToolStateFromToolConfiguration(
  configuration: IToolConfiguration<"samAnnotation">,
) {
  const model: TSamModel = configuration.values.model.value;
  const state: ISamAnnotationToolState = {
    pipeline: createSamPipeline(model),
  };
  return state;
}
