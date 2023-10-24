import {
  RestClientInstance,
  IGirderItem,
  IGirderFolder,
  IGirderSelectAble,
  IGirderUser
} from "@/girder";
import {
  configurationBaseKeys,
  copyLayerWithoutPrivateAttributes,
  exampleConfigurationBase,
  IContrast,
  IDataset,
  IDatasetConfiguration,
  IDatasetConfigurationBase,
  IDatasetView,
  IDatasetViewBase,
  IDisplayLayer,
  IFrameInfo,
  IHistoryEntry,
  IImage,
  IScales,
  IPixel,
  newLayer,
  TJobType
} from "./model";
import {
  toStyle,
  ITileOptionsBands,
  mergeHistograms,
  ITileHistogram
} from "./images";
import { getNumericMetadata } from "@/utils/parsing";
import { Promise } from "bluebird";
import { AxiosRequestConfig, AxiosResponse } from "axios";
import { fetchAllPages } from "@/utils/fetch";
import { stringify } from "qs";

// Modern browsers limit concurrency to a single domain at 6 requests (though
// using HTML 2 might improve that slightly).  For a single layer, if we set
// this to exactly 6, processing in javascript can leave some of the request
// capacity slack.  If it is too great (thousands, for instance), browsers can
// fail.  9 is a balance that is somewhat low but was measured as fast as
// higher values in a limited set of tests.
const HistogramConcurrency: number = 9;

function toId(item: string | { _id: string }) {
  return typeof item === "string" ? item : item._id;
}

function itemsToResourceObject(items: IGirderSelectAble[]) {
  const resourceObj: { folder: string[]; item: string[] } = {
    folder: [],
    item: []
  };
  for (const resource of items) {
    const type = resource._modelType;
    if (type === "folder" || type === "item") {
      resourceObj[type].push(resource._id);
    }
  }
  return resourceObj;
}

export default class GirderAPI {
  readonly client: RestClientInstance;

  private readonly imageCache = new Map<string, HTMLImageElement>();
  private readonly histogramCache = new Map<string, Promise<ITileHistogram>>();
  private readonly resolvedHistogramCache = new Map<string, ITileHistogram>();

  constructor(client: RestClientInstance) {
    this.client = client;
  }

  histogramsLoaded = 0;

  baseHistogramOptions: IHistogramOptions = {
    frame: 0,
    bins: 4096,
    width: 2048,
    height: 2048,
    resample: false,
    cache: "none"
  };

  async getResource(
    id: string,
    type: IGirderSelectAble["_modelType"]
  ): Promise<IGirderSelectAble> {
    const config = { params: { type } };
    const response = await this.client.get(`resource/${id}`, config);
    const resource = response.data;
    if (resource) {
      resource._modelType = type;
    }
    return response.data;
  }

  async getAllUserIds(): Promise<string[]> {
    const result = await this.client.get("user");

    if (result.status !== 200) {
      throw new Error(
        `Could not get a list of all users: ${result.status} ${result.statusText}`
      );
    }
    const users = result.data;
    return users.map((user: IGirderUser) => user._id);
  }

  async getUserPublicFolder(userId?: string): Promise<IGirderFolder | null> {
    let parentId = userId;
    if (userId === undefined) {
      const me = await this.client.get("user/me");
      const myId = me.data?._id;
      if (myId) {
        parentId = myId;
      } else {
        return null;
      }
    }

    const result = await this.client.get(
      `folder?parentType=user&parentId=${parentId}&name=Public`
    );
    return result.data.length > 0 ? result.data[0] : null;
  }

  moveItems(items: IGirderSelectAble[], folderId: string) {
    const resourceObj = itemsToResourceObject(items);
    return this.client.put("resource/move", null, {
      params: {
        resources: JSON.stringify(resourceObj),
        parentType: "folder",
        parentId: folderId
      }
    });
  }

  renameItem(item: IGirderSelectAble, name: string) {
    const type = item._modelType;
    if (!(type === "folder" || type === "item")) {
      return;
    }
    const id = item._id;
    return this.client.put(`${type}/${id}`, null, { params: { name } });
  }

  deleteItems(items: IGirderSelectAble[]) {
    const resourceObj = itemsToResourceObject(items);
    return this.client.delete("resource", {
      params: {
        resources: JSON.stringify(resourceObj)
      }
    });
  }

  undo(datasetId: string) {
    return this.client.put("history/undo", undefined, {
      params: { datasetId }
    });
  }

  redo(datasetId: string) {
    return this.client.put("history/redo", undefined, {
      params: { datasetId }
    });
  }

  async getHistoryEntries(datasetId: string): Promise<IHistoryEntry[]> {
    try {
      const params = { datasetId };
      const response = await this.client.get("history", { params });
      return response.data.map(toHistoryEntry);
    } catch {
      return [];
    }
  }

  generateTiles(itemId: string, force: boolean, localJob: boolean) {
    return this.client.post(`item/${itemId}/tiles`, undefined, {
      params: { force, localJob }
    });
  }

  removeLargeImageForItem(itemId: string) {
    return this.client.delete(`item/${itemId}/tiles`);
  }

  uploadJSONFile(
    name: string,
    content: string,
    parentId: string,
    parentType: "folder" | "item" = "folder"
  ) {
    const blob = new Blob([content], { type: "application/json" });
    return this.client.post(
      `file?parentId=${parentId}&parentType=${parentType}&name=${name}&size=${blob.size}`,
      blob,
      {
        headers: {
          "Content-Type": "text/plain"
        }
      }
    );
  }

  tileTemplateUrl(
    image: IImage,
    color: string,
    contrast: IContrast,
    hist: any,
    layer: IDisplayLayer | null,
    ds: IDataset | null
  ): string | undefined {
    if (hist === null) {
      return;
    }
    const url = new URL(
      `${this.client.apiRoot}/item/${toId(image.item)}/tiles/zxy`
    );
    url.searchParams.set("encoding", "PNG");
    const style = <ITileOptionsBands>(
      toStyle(color, contrast, hist, layer, ds, image)
    );
    if (
      !style.bands ||
      style.bands.length <= 1 ||
      style.bands[0].frame === undefined
    ) {
      url.searchParams.set("frame", image.frameIndex.toString());
    }
    url.searchParams.set("style", JSON.stringify(style));
    url.searchParams.set("edge", "crop");
    return url.href.replace("tiles/zxy", "tiles/zxy/{z}/{x}/{y}");
  }

  getTiles(item: string | IGirderItem): Promise<ITileMeta> {
    return this.client.get(`item/${toId(item)}/tiles`).then(r => r.data);
  }

  getTilesInternalMetadata(item: string | IGirderItem): Promise<any> {
    return this.client
      .get(`item/${toId(item)}/tiles/internal_metadata`)
      .then(r => r.data);
  }

  private getHistogram(
    item: string | IGirderItem,
    options: Partial<IHistogramOptions> = {}
  ): Promise<ITileHistogram> {
    const params: Readonly<IHistogramOptions> = {
      ...this.baseHistogramOptions,
      ...options
    };

    return this.client
      .get(`item/${toId(item)}/tiles/histogram`, { params })
      .then(r => r.data[0]); // TODO deal with multiple channel data
  }

  async getPixelValue(
    image: IImage,
    geoX: number,
    geoY: number
  ): Promise<IPixel> {
    if (geoX < 0 || geoY < 0) {
      return {};
    }
    const left = Math.floor(geoX);
    const top = Math.floor(geoY);
    const frame = image.frameIndex;
    const params = { left, top, frame };
    const itemId = toId(image.item);
    const response = await this.client.get(`item/${itemId}/tiles/pixel`, {
      params
    });
    return response.data;
  }

  getItems(folderId: string): Promise<IGirderItem[]> {
    return this.client
      .get(`item`, {
        params: {
          folderId
        }
      })
      .then(r => r.data);
  }

  getImages(folderId: string): Promise<IGirderItem[]> {
    return this.getItems(folderId).then(items =>
      items.filter(d => d.largeImage)
    );
  }

  createDatasetView(datasetViewBase: IDatasetViewBase) {
    return this.client
      .post("dataset_view", datasetViewBase)
      .then(r => asDatasetView(r.data));
  }

  getDatasetView(id: string) {
    return this.client
      .get(`dataset_view/${id}`)
      .then(r => asDatasetView(r.data));
  }

  deleteDatasetView(id: string) {
    return this.client.delete(`dataset_view/${id}`);
  }

  updateDatasetView(datasetView: IDatasetView) {
    return this.client.put(`dataset_view/${datasetView.id}`, datasetView);
  }

  async findDatasetViews(options?: {
    datasetId?: string;
    configurationId?: string;
  }) {
    const pages = await fetchAllPages(this.client, "dataset_view", {
      params: {
        sort: "lastViewed",
        ...options
      }
    });
    const datasetViews: IDatasetView[] = [];
    for (const page of pages) {
      for (const data of page) {
        datasetViews.push(asDatasetView(data));
      }
    }
    return datasetViews;
  }

  async getRecentDatasetViews(limit: number, offset: number = 0) {
    const formData: AxiosRequestConfig = {
      params: {
        limit,
        offset,
        sort: "lastViewed",
        sortdir: -1
      }
    };
    const response = await this.client.get("dataset_view", formData);
    return (response.data as any[]).map(asDatasetView);
  }

  async getCompatibleConfigurations(dataset: IDataset) {
    const compatibility = getDatasetCompatibility(dataset);
    const pages = await fetchAllPages(this.client, "item/query", {
      params: {
        query: JSON.stringify({
          "meta.subtype": "contrastConfiguration",
          "meta.compatibility": compatibility
        }),
        sort: "updated",
        sortdir: -1
      }
    });
    const configurations: IDatasetConfiguration[] = [];
    for (const page of pages) {
      for (const data of page) {
        configurations.push(asConfigurationItem(data));
      }
    }
    return configurations;
  }

  createDataset(
    name: string,
    description: string,
    path: IGirderSelectAble
  ): Promise<IDataset> {
    const data = new FormData();
    data.set("parentType", path._modelType);
    data.set("parentId", path._id);
    data.set("name", name);
    data.set("description", description);
    data.set("reuseExisting", "false");
    data.set(
      "metadata",
      JSON.stringify({
        subtype: "contrastDataset"
      })
    );
    return this.client.post("folder", data).then(r => asDataset(r.data));
  }

  async getQuickUploadFolder(parentId: string) {
    const data = new FormData();
    data.set("parentType", "folder");
    data.set("parentId", parentId);
    data.set("name", "QuickUpload");
    data.set(
      "description",
      "Contains all datasets uploaded using the QuickUpload feature."
    );
    data.set("reuseExisting", "true");
    const resp = await this.client.post("folder", data);
    return resp.data;
  }

  importDataset(path: IGirderSelectAble): Promise<IDataset> {
    return this.client
      .put(`/folder/${path._id}/metadata`, {
        subtype: "contrastDataset"
      })
      .then(r => asDataset(r.data));
  }

  deleteDataset(dataset: IDataset): Promise<IDataset> {
    return this.client.delete(`/folder/${dataset.id}`).then(() => dataset);
  }

  async createConfigurationFromBase(
    name: string,
    description: string,
    folderId: string,
    base: IDatasetConfigurationBase
  ): Promise<IDatasetConfiguration> {
    // Create metadata for the configuration item
    const metadata: { [key: string]: any } = {
      subtype: "contrastConfiguration",
      compatibility: {},
      ...toConfiguationMetadata(base)
    };

    // Create the item
    const data = new FormData();
    data.set("folderId", folderId);
    data.set("name", name);
    data.set("description", description);
    data.set("reuseExisting", "false");
    data.set("metadata", JSON.stringify(metadata));
    const item: IGirderItem = (await this.client.post("item", data)).data;

    // Create configuration from item and configBase
    return asConfigurationItem(item);
  }

  createConfigurationFromDataset(
    name: string,
    description: string,
    folderId: string,
    dataset: IDataset
  ) {
    return this.createConfigurationFromBase(
      name,
      description,
      folderId,
      defaultConfigurationBase(dataset)
    );
  }

  duplicateConfiguration(
    configuration: IDatasetConfiguration,
    folderId: string
  ) {
    return this.createConfigurationFromBase(
      configuration.name,
      configuration.description,
      folderId,
      configuration
    );
  }

  async updateConfigurationKey(
    config: IDatasetConfiguration,
    key: keyof IDatasetConfigurationBase
  ): Promise<any> {
    const metadata = toConfiguationMetadata({ [key]: config[key] });
    const data = new FormData();
    data.set("metadata", JSON.stringify(metadata));
    const item: IGirderItem = (
      await this.client.put(`item/${config.id}/metadata`, data)
    ).data;
    return item;
  }

  deleteConfiguration(
    config: IDatasetConfiguration
  ): Promise<IDatasetConfiguration> {
    return this.client.delete(`/item/${config.id}`).then(() => config);
  }

  getLayerHistogram(images: IImage[]) {
    const key = images.map(i => `${i.item._id}#${i.frameIndex}`).join(",");
    if (this.histogramCache.has(key)) {
      return this.histogramCache.get(key)!;
    }

    const promise = Promise.map(
      images,
      (image: IImage) =>
        this.getHistogram(image.item, {
          frame: image.frameIndex
        }),
      { concurrency: HistogramConcurrency }
    ).then((histograms: ITileHistogram[]) => mergeHistograms(histograms));
    this.histogramCache.set(key, promise);
    promise.then((hist: ITileHistogram) => {
      this.resolvedHistogramCache.set(key, hist);
      this.histogramsLoaded = this.histogramsLoaded + 1;
      return hist;
    });
    return promise;
  }

  getResolvedLayerHistogram(images: IImage[]) {
    const key = images.map(i => `${i.item._id}#${i.frameIndex}`).join(",");
    if (this.resolvedHistogramCache.has(key)) {
      return this.resolvedHistogramCache.get(key)!;
    }
    return null;
  }

  flushCaches() {
    this.imageCache.forEach(value => {
      if (value.src) {
        // clean up blobs
        URL.revokeObjectURL(value.src);
      }
    });
    this.imageCache.clear();
    this.histogramCache.clear();
    this.resolvedHistogramCache.clear();
  }

  scheduleTileFramesComputation(datasetId: string) {
    return this.getImages(datasetId).then((items: IGirderItem[]) => {
      return items.map((item: IGirderItem) => {
        return this.client.get(
          `/item/${item._id}/tiles/tile_frames/quad_info`,
          {
            params: {
              query:
                "style" +
                encodeURIComponent(
                  JSON.stringify({
                    min: "min",
                    max: "max",
                    palette: ["#000000", "#ffffff"]
                  })
                ) +
                "&cache=true",
              maxTextureSize: 4096,
              maxTextures: 32,
              frameBase: "c",
              frameStride: "c",
              frameGroup: "z",
              frameGroupStride: "auto",
              cache: "schedule"
            }
          }
        );
      });
    });
  }

  scheduleMaxMergeCache(datasetId: string) {
    return this.getImages(datasetId).then((items: IGirderItem[]) => {
      return items.map((item: IGirderItem) => {
        return this.client.put(`/item/${item._id}/cache_maxmerge`);
      });
    });
  }

  async scheduleHistogramCache(datasetId: string) {
    const largeImageItems = await this.getImages(datasetId);
    const responses = [];
    // Don't use a Promise.all to avoid flooding the backend with requests
    // Only send one cache request at a time
    for (const imageItem of largeImageItems) {
      const params: IHistogramOptions = {
        ...this.baseHistogramOptions,
        cache: "schedule"
      };
      const response = await this.client.get(
        `item/${imageItem._id}/tiles/histogram`,
        { params }
      );
      responses.push(response);
    }
    return responses;
  }

  async findJobs(type: TJobType, statuses: number[]): Promise<any[]> {
    const params = {
      types: JSON.stringify([type]),
      statuses: JSON.stringify(statuses)
    };
    const response = await this.client.get("job", {
      params,
      paramsSerializer: stringify
    });
    return response.data;
  }
}

export function asDataset(folder: IGirderFolder): IDataset {
  return {
    id: folder._id,
    name: folder.name,
    description: folder.description,
    xy: [],
    z: [],
    width: 1,
    height: 1,
    time: [],
    channels: [],
    channelNames: new Map<number, string>(),
    images: () => [],
    anyImage: () => null,
    allImages: []
  };
}

function getDefaultLayers(dataset: IDataset) {
  const nLayers = Math.min(6, dataset.channels.length);
  const layers: IDisplayLayer[] = [];
  for (let i = 0; i < nLayers; ++i) {
    layers.push(newLayer(dataset, layers));
  }
  return layers;
}

function getDatasetCompatibility(
  dataset: IDataset
): IDatasetConfigurationBase["compatibility"] {
  const channelNames: IDatasetConfigurationBase["compatibility"]["channels"] = {};
  for (const channel of dataset.channels) {
    channelNames[channel] =
      dataset.channelNames.get(channel) || "Unnamed channel";
  }
  return {
    xyDimensions: dataset.xy.length > 1 ? "multiple" : "one",
    zDimensions: dataset.z.length > 1 ? "multiple" : "one",
    tDimensions: dataset.time.length > 1 ? "multiple" : "one",
    channels: channelNames
  };
}

export function getDatasetScales(dataset: IDataset): IScales {
  const scales = exampleConfigurationBase().scales;
  const tileInfo = dataset.anyImage()?.tileinfo;
  if (tileInfo) {
    scales.pixelSize = {
      value: (tileInfo.mm_x + tileInfo.mm_y) / 2,
      unit: "mm"
    };
  }
  return scales;
}

function defaultConfigurationBase(
  dataset: IDataset
): IDatasetConfigurationBase {
  return {
    compatibility: getDatasetCompatibility(dataset),
    layers: getDefaultLayers(dataset),
    tools: [],
    propertyIds: [],
    snapshots: [],
    scales: getDatasetScales(dataset)
  };
}

function toConfiguationMetadata(data: Partial<IDatasetConfigurationBase>) {
  let metadata: Partial<IDatasetConfigurationBase> = {};
  for (const key in data) {
    // Keep in metadata only keys that are part of IDatasetConfigurationBase
    if ((configurationBaseKeys as Set<string>).has(key)) {
      const typedKey = key as keyof IDatasetConfigurationBase;
      // Strip private attributes from layers (_histogram)
      let values = data[typedKey]!;
      if (typedKey === "layers") {
        values = data[typedKey]!.map(copyLayerWithoutPrivateAttributes);
      }
      // metadata[typedKey] = values; doesn't work because of typescript
      metadata = { ...metadata, [typedKey]: values };
    }
  }
  return metadata;
}

export function asConfigurationItem(item: IGirderItem): IDatasetConfiguration {
  const config: Partial<IDatasetConfiguration> = {
    id: item._id,
    name: item.name,
    description: item.description
  };
  for (const key of configurationBaseKeys) {
    config[key] =
      key in item.meta ? item.meta[key] : exampleConfigurationBase()[key];
  }
  return config as IDatasetConfiguration;
}

function asDatasetView(data: AxiosResponse["data"]): IDatasetView {
  return {
    id: data._id,
    configurationId: data.configurationId,
    datasetId: data.datasetId,
    layerContrasts: data.layerContrasts || {},
    scales: data.scales || {},
    lastViewed: data.lastViewed
  };
}

function toHistoryEntry(data: any): IHistoryEntry {
  return {
    actionName: data.actionName,
    isUndone: data.isUndone,
    actionDate: new Date(data.actionDate)
  };
}

export interface IHistogramOptions {
  frame: number;
  bins: number;
  width: number;
  height: number;
  resample: boolean;
  cache: "schedule" | "report" | "none";
}

export interface ITileMeta {
  [x: string]: any;
  IndexRange: any;
  levels: number;
  magnification: number;
  mm_x: number;
  mm_y: number;
  sizeX: number;
  sizeY: number;
  tileWidth: number;
  tileHeight: number;
  frames: IFrameInfo[];
  omeinfo: IOMEInfo;
  channels: string[];
}

interface IOMEInfo {
  Image: {
    ID: string;
    Pixels: {
      SizeC: string; // but a number
      SizeT: string; // but a number
      SizeX: string; // but a number
      SizeY: string; // but a number
      SizeZ: string; // but a number
    };
  };
}

// in the end need a function that maps: t,z,c -> to an image (or tiled image) to be loaded which end up to be the frame
// number of time points

function toKey(
  z: number | string,
  time: number | string,
  xy: number | string,
  c: number | string
) {
  return `z${z}:t${time}:xy${xy}:c${c}`;
}

export function parseTiles(
  item: IGirderItem,
  tile: ITileMeta,
  unrollXY: boolean,
  unrollZ: boolean,
  unrollT: boolean
) {
  const xys = new Set<number>();
  const zs = new Map<number, Set<number>>();
  const cs = new Set<number>();

  const channelInt = new Map<string | null, number>();
  const lookup = new Map<string, IImage[]>();
  let frameChannels: string[] | undefined;
  let unrollCount: { [key: string]: number } = { t: 1, xy: 1, z: 1 };
  let unrollOrder: string[] = [];
  // const metadata = getNumericMetadata(item.name);
  interface NumericMetadata {
    t: number | null;
    xy: number | null;
    z: number | null;
    chan: string | null;
  }
  const metadata: NumericMetadata = { t: null, xy: null, z: null, chan: null };
  if (metadata.chan !== null && !channelInt.has(metadata.chan)) {
    channelInt.set(metadata.chan, channelInt.size);
  }

  frameChannels = tile.channels;

  if (!tile.frames) {
    tile.frames = [({ Index: 0, Frame: 0 } as unknown) as IFrameInfo];
  }

  tile.frames.forEach((frame, j) => {
    let t = metadata.t !== null ? metadata.t : frame.IndexT || 0;
    let xy = metadata.xy !== null ? metadata.xy : frame.IndexXY || 0;
    let z =
      metadata.z !== null
        ? metadata.z
        : frame.IndexZ !== undefined
        ? frame.IndexZ
        : frame.PositionZ || 0;
    if (unrollT) {
      unrollCount.t = Math.max(unrollCount.t, t + 1);
      t = -1;
      if (!unrollOrder.includes("t")) {
        unrollOrder.push("t");
      }
    }
    if (unrollXY) {
      unrollCount.xy = Math.max(unrollCount.xy, xy + 1);
      xy = -1;
      if (!unrollOrder.includes("xy")) {
        unrollOrder.push("xy");
      }
    }
    if (unrollZ) {
      unrollCount.z = Math.max(unrollCount.z, z + 1);
      z = -1;
      if (!unrollOrder.includes("z")) {
        unrollOrder.push("z");
      }
    }
    const metadataChannel =
      channelInt.size > 1 ? channelInt.get(metadata.chan) : undefined;
    const c =
      metadataChannel !== undefined
        ? metadataChannel
        : frame.IndexC !== undefined
        ? frame.IndexC
        : 0;
    if (zs.has(z)) {
      zs.get(z)!.add(t);
    } else {
      zs.set(z, new Set([t]));
    }
    xys.add(xy);
    cs.add(c);
    const key = toKey(z, t, xy, c);
    const info: IImage = {
      frame,
      levels: tile.levels,
      frameIndex: j,
      key: { z: z, t: t, xy: xy, c: c },
      keyOffset: lookup.has(key) ? lookup.get(key)!.length : 0,
      item,
      sizeX: tile.sizeX,
      sizeY: tile.sizeY,
      tileWidth: tile.tileWidth,
      tileHeight: tile.tileHeight,
      tileinfo: tile,
      mm_x: tile.mm_x,
      mm_y: tile.mm_y
    };
    if (!lookup.has(key)) {
      lookup.set(key, [info]);
    } else {
      lookup.get(key)!.push(info);
    }
  });

  let width = 0;
  let height = 0;

  // Lay out images in a grid that is as roughly square as possible.
  //
  // TODO: this approach assumes all images have the same size.
  lookup.forEach(images => {
    let rowLength = Math.ceil(Math.sqrt(images.length));
    if (unrollOrder.length > 1) {
      rowLength = unrollCount[unrollOrder[0]];
    }
    const colLength = Math.ceil(images.length / rowLength);

    const cwidth = rowLength * images[0].sizeX;
    const cheight = colLength * images[0].sizeY;
    if (cwidth > width) {
      width = cwidth;
    }
    if (cheight > height) {
      height = cheight;
    }
  });

  const entries = Array.from(zs.entries()).sort((a, b) => a[0] - b[0]);
  const zValues: number[] = entries.map(() => NaN);
  const numberOfTimeSlots = entries.reduce(
    (acc, v) => Math.max(acc, v[1].size),
    0
  );
  const timeValues: number[] = Array.from({ length: numberOfTimeSlots });

  entries.forEach(([k, v], i) => {
    zValues[i] = k;
    const tValues = Array.from(v).sort((a, b) => a - b);
    tValues.forEach((t, j) => {
      timeValues[j] = t;
    });
  });

  const channels = Array.from(cs).sort((a, b) => a - b);

  // Create a map of channel names for use in display.
  const channelNames = new Map<number, string>();
  if (frameChannels === undefined) {
    for (const entry of channelInt) {
      channelNames.set(entry[1], entry[0]!);
    }
  } else {
    frameChannels.forEach((channel: string, index: number) => {
      channelNames.set(index, channel);
    });
  }

  const allImages: IImage[] = [];
  for (const images of lookup.values()) {
    allImages.push(...images);
  }
  return {
    images: (z: number, time: number, xy: number, channel: number) =>
      lookup.get(toKey(z, time, xy, channel)) || [],
    anyImage: () => allImages[0] ?? null,
    allImages,
    xy: Array.from(xys).sort((a, b) => a - b),
    z: zValues,
    time: timeValues,
    channels,
    channelNames,
    width,
    height
  };
}
