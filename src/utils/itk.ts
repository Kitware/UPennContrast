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
      pointComponentType: "float"
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
    cellBufferSize: 0
  };
}

async function getThresholdBlobInContour(
  image: Uint8Array,
  contour: IGeoJSPoint[] = [],
  geoJSMap: any
): Promise<IGeoJSPoint[]> {
  const mesh = geoJSCoordinatesTo2DITKMesh(contour, geoJSMap);
  return await new Promise((resolve, reject) => {
    const args: string[] = ["/inimage.png", "/inpoints.json", "/out.json"];
    const pipelineInputs = [
      {
        path: "/inimage.png",
        data: image,
        type: IOTypes.Binary
      },
      {
        path: "/inpoints.json",
        data: mesh,
        type: IOTypes.Mesh
      }
    ];
    const pipelineOutputs = [
      {
        path: "out.json",
        type: IOTypes.Text
      }
    ];
    return runPipelineBrowser(
      null,
      "Threshold",
      args,
      pipelineOutputs,
      pipelineInputs
    )
      .then(({ outputs, webWorker }: { outputs: any; webWorker: Worker }) => {
        if (!outputs || !outputs.length) {
          reject();
        }
        const result = JSON.parse(outputs[0].data);
        webWorker.terminate();
        if (!result?.contour) {
          logError(
            "Error getting data back from the pipeline. Could not find max"
          );
          reject();
        }
        const converted = geoJSMap.displayToGcs(result.contour);
        resolve(converted);
      })
      .catch((error: any) => {
        logError(`Failed to run ITK pipeline ${error}`);
        reject();
      });
  });
}

async function getMaximumPointInContour(
  image: Uint8Array,
  contour: IGeoJSPoint[] = [],
  geoJSMap: any
): Promise<IGeoJSPoint> {
  const mesh = geoJSCoordinatesTo2DITKMesh(contour, geoJSMap);
  return await new Promise((resolve, reject) => {
    const args: string[] = ["/inimage.png", "/inpoints.json", "/out.json"];
    const pipelineInputs = [
      {
        path: "/inimage.png",
        data: image,
        type: IOTypes.Binary
      },
      {
        path: "/inpoints.json",
        data: mesh,
        type: IOTypes.Mesh
      }
    ];
    const pipelineOutputs = [
      {
        path: "out.json",
        type: IOTypes.Text
      }
    ];
    return runPipelineBrowser(
      null,
      "Max",
      args,
      pipelineOutputs,
      pipelineInputs
    )
      .then(({ outputs, webWorker }: { outputs: any; webWorker: Worker }) => {
        if (!outputs || !outputs.length) {
          reject();
        }
        const result = JSON.parse(outputs[0].data);
        webWorker.terminate();
        if (!result?.point) {
          logError(
            "Error getting data back from the pipeline. Could not find max"
          );
          reject();
        }
        const converted = geoJSMap.displayToGcs(result.point);
        resolve(converted);
      })
      .catch((error: any) => {
        logError(`Failed to run ITK pipeline ${error}`);
        reject();
      });
  });
}

export async function snapCoordinates(
  coordinates: IGeoJSPoint[],
  imageArray: Uint8Array,
  tool: IToolConfiguration,
  geoJSMap: any
) {
  const snapTo = tool.values.snapTo.value;
  switch (snapTo) {
    case "ellipseToDot":
    case "blobToDot":
      const point = await getMaximumPointInContour(
        imageArray,
        coordinates,
        geoJSMap
      );
      return [point];
    case "blobToBlob":
      const contour = await getThresholdBlobInContour(
        imageArray,
        coordinates,
        geoJSMap
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
