import {
  RestClientInstance,
  IGirderItem,
  IGirderFolder,
  IGirderFile,
  IGirderSelectAble
} from "@/girder";
import {
  IDataset,
  IDatasetConfiguration,
  IDisplayLayer,
  isConfigurationItem,
  IFrameInfo,
  IImage,
  IContrast,
  IImageTile,
  newLayer,
  IViewConfiguration
} from "./model";
import {
  toStyle,
  ITileOptions,
  mergeHistograms,
  ITileHistogram
} from "./images";
import { getNumericMetadata } from "@/utils/parsing";
import { Promise } from "bluebird";

// Modern browsers limit concurrency to a single domain at 6 requests (though
// using HTML 2 might improve that slightly).  For a single layer, if we set
// this to exactly 6, processing in javascript can leave some of the request
// capacity slack.  If it is too great (thousands, for instance), browsers can
// fail.  9 is a balance that is somewhat low but was measured as fast as
// higher values in a limited set of tests.
const ImageConcurrency: number = 9;
const HistogramConcurrency: number = 9;

interface HTMLImageElementLocal extends HTMLImageElement {
  _waitForHistogram?: boolean;
  _promise: () => Promise<void | null> | null;
}

function toId(item: string | { _id: string }) {
  return typeof item === "string" ? item : item._id;
}

export default class GirderAPI {
  private readonly client: RestClientInstance;

  private readonly imageCache = new Map<string, HTMLImageElement>();
  private readonly fullImageCache = new Map<string, HTMLImageElement>();
  private readonly histogramCache = new Map<string, Promise<ITileHistogram>>();
  private readonly resolvedHistogramCache = new Map<string, ITileHistogram>();

  constructor(client: RestClientInstance) {
    this.client = client;
  }

  histogramsLoaded = 0;

  getItem(itemId: string): Promise<IGirderItem> {
    return this.client.get(`item/${itemId}`).then(r => r.data);
  }
  getFolder(folderId: string): Promise<IGirderFolder> {
    return this.client.get(`folder/${folderId}`).then(r => r.data);
  }

  async getUserPublicFolder(): Promise<IGirderFolder> {
    const me = await this.client.get("user/me");
    const result = await this.client.get(
      `folder?parentType=user&parentId=${me.data._id}&name=Public`
    );
    return result.data.length > 0 ? result.data[0] : null;
  }

  getFiles(item: string | IGirderItem): Promise<IGirderFile[]> {
    return this.client.get(`item/${toId(item)}/files`).then(r => r.data);
  }
  downloadUrl(item: string | IGirderItem) {
    const url = new URL(`${this.client.apiRoot}/item/${toId(item)}/download`);
    url.searchParams.set("contentDisposition", "inline");
    return url.href;
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
    url.searchParams.set("frame", image.frameIndex.toString());
    const style = toStyle(color, contrast, hist, layer, ds, image);
    url.searchParams.set("style", JSON.stringify(style));
    url.searchParams.set("edge", "crop");
    return url.href.replace("tiles/zxy", "tiles/zxy/{z}/{x}/{y}");
  }

  getTiles(item: string | IGirderItem): Promise<ITileMeta> {
    return this.client.get(`item/${toId(item)}/tiles`).then(r => r.data);
  }

  private getHistogram(
    item: string | IGirderItem,
    options: Partial<IHistogramOptions> = {}
  ): Promise<ITileHistogram> {
    const o: Readonly<IHistogramOptions> = Object.assign(
      {
        frame: 0,
        bins: 512,
        width: 2048,
        height: 2048,
        resample: false
      },
      options
    );

    return this.client
      .get(`item/${toId(item)}/tiles/histogram`, {
        params: o
      })
      .then(r => r.data[0]); // TODO deal with multiple channel data
  }

  private getItems(folderId: string): Promise<IGirderItem[]> {
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
      items.filter(d => (d as any).largeImage)
    );
  }

  getDataset(
    id: string,
    unrollXY: boolean,
    unrollZ: boolean,
    unrollT: boolean
  ): Promise<IDataset> {
    return Promise.all([this.getFolder(id), this.getItems(id)]).then(
      ([folder, items]) => {
        const images = items.filter(d => (d as any).largeImage);
        return Promise.all(images.map(item => this.getTiles(item))).then(
          tiles => {
            const configurations = items
              .filter(isConfigurationItem)
              .map(asConfigurationItem);
            return {
              ...asDataset(folder),
              configurations,
              ...parseTiles(images, tiles, unrollXY, unrollZ, unrollT)
            };
          }
        );
      }
    );
  }

  getDatasetConfiguration(id: string): Promise<IDatasetConfiguration> {
    return this.getItem(id).then(asConfigurationItem);
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

  createConfiguration(
    name: string,
    description: string,
    dataset: IDataset
  ): Promise<IDatasetConfiguration> {
    const data = new FormData();
    data.set("folderId", dataset.id);
    data.set("name", name);
    data.set("description", description);
    data.set("reuseExisting", "false");
    const channels = dataset.channels.slice(0, 6);
    const layers: IDisplayLayer[] = [];
    channels.forEach(() => layers.push(newLayer(dataset, layers)));
    const view: IViewConfiguration = { layers };
    data.set(
      "metadata",
      JSON.stringify({
        subtype: "contrastConfiguration",
        view
      })
    );
    return this.client
      .post("item", data)
      .then(r => asConfigurationItem(r.data));
  }

  updateConfiguration(
    config: IDatasetConfiguration
  ): Promise<IDatasetConfiguration> {
    return this.client
      .put(`/item/${config.id}/metadata`, {
        view: {
          layers: config.view.layers.map(l =>
            Object.fromEntries(
              Object.entries(l).filter(([k]) => !k.startsWith("_"))
            )
          )
        }
      })
      .then(() => config);
  }

  updateSnapshots(
    config: IDatasetConfiguration
  ): Promise<IDatasetConfiguration> {
    return this.client
      .put(`/item/${config.id}/metadata`, {
        snapshots: config.snapshots! || []
      })
      .then(() => config);
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
}

function asDataset(folder: IGirderFolder): IDataset {
  return {
    id: folder._id,
    _girder: folder,
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
    configurations: []
  };
}

function asConfigurationItem(item: IGirderItem): IDatasetConfiguration {
  const configuration = {
    id: item._id,
    _girder: item,
    name: item.name,
    description: item.description,
    view: item.meta.view || { layers: item.meta.layers || [] },
    snapshots: item.meta.snapshots || []
  };
  return configuration;
}

export interface IHistogramOptions {
  frame: number;
  bins: number;
  width: number;
  height: number;
  resample: boolean;
}

export interface ITileMeta {
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

function parseTiles(
  items: IGirderItem[],
  tiles: ITileMeta[],
  unrollXY: boolean,
  unrollZ: boolean,
  unrollT: boolean
) {
  // t x z x c -> IImage[]

  // z -> times
  const xys = new Set<number>();
  const zs = new Map<number, Set<number>>();
  const cs = new Set<number>();

  const channelInt = new Map<string | null, number>();
  const lookup = new Map<string, IImage[]>();
  let frameChannels: string[] | undefined;
  let unrollCount: { [key: string]: number } = { t: 1, xy: 1, z: 1 };
  let unrollOrder: string[] = [];
  tiles.forEach((tile, i) => {
    const item = items[i]!;
    const metadata = getNumericMetadata(item.name);
    if (metadata.chan !== null && !channelInt.has(metadata.chan)) {
      channelInt.set(metadata.chan, channelInt.size);
    }

    frameChannels = tile.channels;

    if (!tile.frames) {
      tile.frames = [({ Index: 0, Frame: 0 } as unknown) as IFrameInfo];
    }

    tile.frames.forEach((frame, j) => {
      let t = metadata.t !== null ? metadata.t : frame.IndexT;
      let xy = metadata.xy !== null ? metadata.xy : frame.IndexXY || 0;
      let z =
        metadata.z !== null
          ? metadata.z
          : frame.IndexZ !== undefined
          ? frame.IndexZ
          : frame.PositionZ;
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
          : frame.IndexC === undefined
          ? 0
          : frame.IndexC;
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
        mm_x: tile.mm_x,
        mm_y: tile.mm_y
      };
      if (!lookup.has(key)) {
        lookup.set(key, [info]);
      } else {
        lookup.get(key)!.push(info);
      }
    });
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

  return {
    images: (z: number, time: number, xy: number, channel: number) =>
      lookup.get(toKey(z, time, xy, channel)) || [],
    anyImage: () => {
      const values = lookup.values();
      let it = values.next();
      while (!it.done) {
        if (it.value.length > 0) {
          return it.value[0];
        }

        it = values.next();
      }

      return null;
    },
    xy: Array.from(xys).sort((a, b) => a - b),
    z: zValues,
    time: timeValues,
    channels,
    channelNames,
    width,
    height
  };
}
