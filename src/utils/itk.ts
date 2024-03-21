import { logError } from "@/utils/log";
import { IGeoJSMap, IGeoJSPoint, IToolConfiguration } from "@/store/model";
import {
  InterfaceTypes,
  runPipeline,
  BinaryFile,
  TextFile,
  PipelineInput,
} from "itk-wasm";

function geoJSCoordinatesToBinaryFileData(
  coordinates: IGeoJSPoint[],
  map: IGeoJSMap,
): Uint8Array {
  const numberOfPoints = coordinates.length;
  const points = new Float32Array(2 * numberOfPoints);
  for (let i = 0; i < numberOfPoints; ++i) {
    const displayCoordinates = map.gcsToDisplay(coordinates[i]);
    points[2 * i] = displayCoordinates.x;
    points[2 * i + 1] = displayCoordinates.y;
  }
  return new Uint8Array(points.buffer);
}

async function runItkPipelineWrapper(
  pipelineName: string,
  image: Uint8Array,
  otherInputs: PipelineInput[],
  otherArgs: string[],
): Promise<any> {
  const imageFilePath = "./inimage.png";
  const inputImage: BinaryFile = { data: image, path: imageFilePath };
  const pipelineInputs: PipelineInput[] = [
    {
      data: inputImage,
      type: InterfaceTypes.BinaryFile,
    },
    ...otherInputs,
  ];
  const outPath = "./out.json";
  const pipelineOutputs = [
    {
      data: { path: outPath },
      type: InterfaceTypes.TextFile,
    },
  ];
  const pipelineArgs: string[] = [imageFilePath, ...otherArgs, outPath];
  try {
    const { outputs, webWorker } = await runPipeline(
      pipelineName,
      pipelineArgs,
      pipelineOutputs,
      pipelineInputs,
    );
    const textFile = outputs[0]?.data as TextFile | undefined;
    if (!textFile) {
      webWorker?.terminate();
      throw new Error("Pipeline didn't return a value");
    } else {
      const result = JSON.parse(textFile.data);
      webWorker?.terminate();
      return result;
    }
  } catch (error: any) {
    logError(`Failed to run ITK pipeline`);
    logError(error);
  }
}

async function getThresholdBlobInContour(
  image: Uint8Array,
  contour: IGeoJSPoint[] = [],
  geoJSMap: IGeoJSMap,
): Promise<IGeoJSPoint[]> {
  const meshFilePath = "./inpoints.obj";
  const meshFileData = geoJSCoordinatesToBinaryFileData(contour, geoJSMap);
  const meshFile: BinaryFile = { path: meshFilePath, data: meshFileData };
  const result = await runItkPipelineWrapper(
    "BlobToBlobThreshold",
    image,
    [{ data: meshFile, type: InterfaceTypes.BinaryFile }],
    [meshFilePath],
  );
  const outputContour = result?.contour;
  if (!outputContour) {
    throw new Error(
      "Error getting data back from the pipeline. Could not find contour",
    );
  }
  return geoJSMap.displayToGcs(outputContour as IGeoJSPoint[]);
}

async function getMaximumPointInContour(
  image: Uint8Array,
  contour: IGeoJSPoint[] = [],
  geoJSMap: IGeoJSMap,
): Promise<IGeoJSPoint> {
  const meshFilePath = "./inpoints.obj";
  const meshFileData = geoJSCoordinatesToBinaryFileData(contour, geoJSMap);
  const meshFile: BinaryFile = { path: meshFilePath, data: meshFileData };
  const result = await runItkPipelineWrapper(
    "BlobToDotMax",
    image,
    [{ data: meshFile, type: InterfaceTypes.BinaryFile }],
    [meshFilePath],
  );
  const outputPoint = result?.point;
  if (!outputPoint) {
    throw new Error(
      "Error getting data back from the pipeline. Could not find max",
    );
  }
  return geoJSMap.displayToGcs(outputPoint);
}

async function getMaximumPointInCircle(
  image: Uint8Array,
  gcsCenter: IGeoJSPoint,
  radius: number,
  geoJSMap: IGeoJSMap,
): Promise<IGeoJSPoint> {
  const displayCenter = geoJSMap.gcsToDisplay(gcsCenter);
  const circleFileName = "./circle.txt";
  const textFile: TextFile = {
    path: circleFileName,
    data: `${displayCenter.x} ${displayCenter.y} ${radius}`,
  };
  const textInput: PipelineInput = {
    data: textFile,
    type: InterfaceTypes.TextFile,
  };
  const result = await runItkPipelineWrapper(
    "CircleToDotMax",
    image,
    [textInput],
    [circleFileName],
  );
  const outputPoint = result?.point;
  if (!outputPoint) {
    throw new Error(
      "Error getting data back from the pipeline. Could not find max",
    );
  }
  return geoJSMap.displayToGcs(outputPoint);
}

export async function snapCoordinates(
  coordinates: IGeoJSPoint[],
  imageArray: Uint8Array,
  tool: IToolConfiguration,
  geoJSMap: IGeoJSMap,
) {
  const snapTo = tool.values.snapTo.value;
  switch (snapTo) {
    case "circleToDot":
      if (typeof tool.values.radius === "number") {
        return [
          await getMaximumPointInCircle(
            imageArray,
            coordinates[0],
            tool.values.radius,
            geoJSMap,
          ),
        ];
      }
      return undefined;
    case "blobToDot":
      const point = await getMaximumPointInContour(
        imageArray,
        coordinates,
        geoJSMap,
      );
      return [point];
    case "blobToBlob":
      const contour = await getThresholdBlobInContour(
        imageArray,
        coordinates,
        geoJSMap,
      );
      return contour;
    case "edge":
      logError("Edge snapping is not implemented yet");
      return [];
      break;
    default:
      logError(`Unknown snapping tool type: ${snapTo}`);
      return null;
  }
}
