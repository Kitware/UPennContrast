import { InferenceSession, env } from "onnxruntime-web/webgpu";

env.wasm.wasmPaths = "onnx-wasm/";

const modelBufferCache: Record<string, Promise<ArrayBuffer>> = {};

async function fetchModelBuffer(modelPath: string): Promise<ArrayBuffer> {
  const response = await fetch(modelPath);
  const buffer = await response.arrayBuffer();
  return buffer;
}

export async function createOnnxInferenceSession(
  modelPath: string,
  options?: InferenceSession.SessionOptions,
) {
  if (!(modelPath in modelBufferCache)) {
    modelBufferCache[modelPath] = fetchModelBuffer(modelPath);
  }
  const modelBuffer = await modelBufferCache[modelPath];
  const session = InferenceSession.create(modelBuffer, options);
  return session;
}
