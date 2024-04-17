import { ITileOptionsBands, getBandOption } from "@/store/images";
import {
  IDataset,
  IDatasetLocation,
  IDisplayLayer,
  IDownloadParameters,
  IGeoJSBounds,
} from "@/store/model";

export function getDownloadParameters(
  bounds: IGeoJSBounds,
  fileName: string,
  format: string,
  maxPixels: number,
  jpegQuality: number,
  downloadMode: "layers" | "channels",
) {
  const params: IDownloadParameters = {
    encoding: format.toUpperCase(),
    contentDisposition: "attachment",
    contentDispositionFilename: fileName,
    ...bounds,
    width: bounds.right - bounds.left,
    height: bounds.bottom - bounds.top,
  };
  if (format === "jpeg") {
    params.jpeqQuality = jpegQuality;
  } else if (format === "tiff") {
    params.tiffCompression = "raw";
  }

  // Maximum 4M pixels per image
  const nPixels = params.width * params.height;
  if (nPixels > maxPixels) {
    if (downloadMode === "layers") {
      // Scale the image
      const scale = Math.sqrt(maxPixels / nPixels);
      params.width = Math.floor(scale * params.width);
      params.height = Math.floor(scale * params.height);
    } else if (downloadMode === "channels") {
      // Don't scale when in "channels" mode
      return null;
    }
  }
  return params;
}

export function getBaseURLFromDownloadParameters(
  params: IDownloadParameters,
  itemId: string,
  apiRoot: string,
) {
  const baseUrl = new URL(`${apiRoot}/item/${itemId}/tiles/region`);
  for (const [key, value] of Object.entries(params)) {
    baseUrl.searchParams.set(key, value);
  }
  return baseUrl;
}

export async function getLayersDownloadUrls(
  baseUrl: URL,
  exportLayer: "all" | "composite" | string,
  configurationLayers: IDisplayLayer[],
  dataset: IDataset,
  location: IDatasetLocation,
) {
  // Get layer bands: style and frame idx
  const styles: ITileOptionsBands["bands"] = [];
  const promises: Promise<any>[] = [];
  const pushStyle = styles.push.bind(styles);
  if (exportLayer === "composite" || exportLayer === "all") {
    configurationLayers.forEach((layer) => {
      if (layer.visible || exportLayer === "all") {
        promises.push(getBandOption(dataset, layer, location).then(pushStyle));
      }
    });
  } else {
    const layerId = exportLayer;
    const layer = configurationLayers.find((layer) => layer.id === layerId);
    if (!layer) {
      return [];
    }
    promises.push(getBandOption(dataset, layer, location).then(pushStyle));
  }
  await Promise.all(promises);

  // Return one URL per band or a single URL with all bands
  if (exportLayer === "all") {
    const urls = [];
    for (const style of styles) {
      const url = new URL(baseUrl);
      url.searchParams.set("style", JSON.stringify(style));
      urls.push(url);
    }
    return urls;
  } else {
    const url = new URL(baseUrl);
    const combinedStyle: ITileOptionsBands = {
      bands: styles.reduce(
        (currentBands: ITileOptionsBands["bands"], style) => {
          if ("bands" in style) {
            currentBands.push(...style.bands);
          } else {
            currentBands.push(style);
          }
          return currentBands;
        },
        [],
      ),
    };
    url.searchParams.set("style", JSON.stringify(combinedStyle));
    return [url];
  }
}

export function getChannelsDownloadUrls(
  baseUrl: URL,
  exportChannel: "all" | number,
  dataset: IDataset,
  location: IDatasetLocation,
) {
  const datasetChannels = dataset.channels;
  let channelsToDownload: number[];
  if (exportChannel === "all") {
    channelsToDownload = datasetChannels;
  } else {
    channelsToDownload = [exportChannel];
  }
  const urls: URL[] = [];
  const { xy, z, time } = location;
  for (const channel of channelsToDownload) {
    const image = dataset.images(z, time, xy, channel)[0];
    if (!image) {
      throw new Error(
        `Image not found for channel ${dataset.channelNames.get(channel)}`,
      );
    }
    // Don't modify the base url
    const url = new URL(baseUrl);
    url.searchParams.set("frame", image.frameIndex.toString());
    urls.push(url);
  }
  return urls;
}
