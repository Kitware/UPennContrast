import { logError } from "@/utils/log";
import { IGeoJSPoint, IToolConfiguration } from "@/store/model";
import IOTypes from "itk/IOTypes";
import runPipelineBrowser from "itk/runPipelineBrowser";

function geoJSCoordinatesTo2DITKMesh(coordinates: IGeoJSPoint[], map: any) {
  const pointsArray = new Float32Array(coordinates.length * 2);
  for (let i = 0; i < coordinates.length; ++i) {
    const displayCoordinates = map.gcsToDisplay(coordinates[i]);
    pointsArray[2 * i] = displayCoordinates.x;
    pointsArray[2 * i + 1] = displayCoordinates.y;
  }

  return {
    meshType: {
      dimension: 2,
      pointComponentType: "float",
    },
    dimension: 2,
    numberOfPoints: coordinates.length,
    points: pointsArray,
    numberOfPointPixels: 0,
    pointData: new Uint32Array(),
    numberOfCells: 0,
    cells: new Uint32Array(),
    numberOfCellPixels: 0,
    cellData: new Uint32Array(),
    cellBufferSize: 0,
  };
}

function runItkPipelineWrapper(
  pipelineName: string,
  image: Uint8Array,
  otherArgs: { path: string; data: any; type: any }[],
): Promise<any> {
  return new Promise((resolve, reject) => {
    const args: string[] = [
      "/inimage.png",
      ...otherArgs.map((arg) => arg.path),
      "/out.json",
    ];
    const pipelineInputs = [
      {
        path: "/inimage.png",
        data: image,
        type: IOTypes.Binary,
      },
      ...otherArgs,
    ];
    const pipelineOutputs = [
      {
        path: "out.json",
        type: IOTypes.Text,
      },
    ];
    return runPipelineBrowser(
      null,
      pipelineName,
      args,
      pipelineOutputs,
      pipelineInputs,
    )
      .then(({ outputs, webWorker }: { outputs: any; webWorker: Worker }) => {
        if (!outputs || outputs.length !== 1 || outputs[0].data === "") {
          webWorker.terminate();
          logError(`Pipeline didn't return a value`);
          reject();
        } else {
          const result = JSON.parse(outputs[0].data);
          webWorker.terminate();
          resolve(result);
        }
      })
      .catch((error: any) => {
        logError(`Failed to run ITK pipeline:
${error.message}
${error.stack}`);
        reject();
      });
  });
}

function getThresholdBlobInContour(
  image: Uint8Array,
  contour: IGeoJSPoint[] = [],
  geoJSMap: any,
): Promise<IGeoJSPoint[]> {
  return new Promise((resolve, reject) => {
    runItkPipelineWrapper("BlobToBlobThreshold", image, [
      {
        path: "/inpoints.json",
        data: geoJSCoordinatesTo2DITKMesh(contour, geoJSMap),
        type: IOTypes.Mesh,
      },
    ])
      .then((result) => {
        if (!result?.contour) {
          logError(
            "Error getting data back from the pipeline. Could not find contour",
          );
          reject();
        } else {
          const converted = geoJSMap.displayToGcs(result.contour);
          resolve(converted);
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
}

function getMaximumPointInContour(
  image: Uint8Array,
  contour: IGeoJSPoint[] = [],
  geoJSMap: any,
): Promise<IGeoJSPoint> {
  return new Promise((resolve, reject) => {
    runItkPipelineWrapper("BlobToDotMax", image, [
      {
        path: "/inpoints.json",
        data: geoJSCoordinatesTo2DITKMesh(contour, geoJSMap),
        type: IOTypes.Mesh,
      },
    ])
      .then((result) => {
        if (!result?.point) {
          reject(
            "Error getting data back from the pipeline. Could not find max",
          );
        } else {
          const converted = geoJSMap.displayToGcs(result.point);
          resolve(converted);
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
}

function getMaximumPointInCircle(
  image: Uint8Array,
  gcsCenter: IGeoJSPoint,
  radius: number,
  geoJSMap: any,
): Promise<IGeoJSPoint> {
  const displayCenter = geoJSMap.gcsToDisplay(gcsCenter);
  return new Promise((resolve, reject) => {
    runItkPipelineWrapper("CircleToDotMax", image, [
      {
        path: "/circle",
        data: `${displayCenter.x} ${displayCenter.y} ${radius}`,
        type: IOTypes.Text,
      },
    ])
      .then((result) => {
        if (!result?.point) {
          reject(
            "Error getting data back from the pipeline. Could not find max",
          );
        } else {
          const converted = geoJSMap.displayToGcs(result.point);
          resolve(converted);
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
}

export async function snapCoordinates(
  coordinates: IGeoJSPoint[],
  imageArray: Uint8Array,
  tool: IToolConfiguration,
  geoJSMap: any,
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
