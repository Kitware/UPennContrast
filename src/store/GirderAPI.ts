import {
  RestClient,
  IGirderItem,
  IGirderFolder,
  IGirderFile,
  IGirderSelectAble
} from "@girder/components/src";
import {
  IDataset,
  IDatasetConfiguration,
  isConfigurationItem,
  IFrameInfo,
  IImage,
  IContrast,
  IImageTile,
  newLayer
} from "./model";
import {
  toStyle,
  ITileOptions,
  mergeHistograms,
  ITileHistogram
} from "./images";

function toId(item: string | { _id: string }) {
  return typeof item === "string" ? item : item._id;
}

export default class GirderAPI {
  private readonly client: RestClient;

  private readonly imageCache = new Map<string, HTMLImageElement>();
  private readonly histogramCache = new Map<string, Promise<ITileHistogram>>();
  private readonly resolvedHistogramCache = new Map<string, ITileHistogram>();

  constructor(client: RestClient) {
    this.client = client;
  }

  getItem(itemId: string): Promise<IGirderItem> {
    return this.client.get(`item/${itemId}`).then(r => r.data);
  }
  getFolder(folderId: string): Promise<IGirderFolder> {
    return this.client.get(`folder/${folderId}`).then(r => r.data);
  }
  getFiles(item: string | IGirderItem): Promise<IGirderFile[]> {
    return this.client.get(`item/${toId(item)}/files`).then(r => r.data);
  }
  downloadUrl(item: string | IGirderItem) {
    const url = new URL(`${this.client.apiRoot}/item/${toId(item)}/download`);
    url.searchParams.set("contentDisposition", "inline");
    return url.href;
  }

  tileUrl(
    item: string | IGirderItem,
    { x, y, z, frame }: { x: number; y: number; z: number; frame: number },
    style: ITileOptions
  ) {
    const url = new URL(
      `${this.client.apiRoot}/item/${toId(item)}/tiles/zxy/${z}/${x}/${y}`
    );
    url.searchParams.set("encoding", "PNG");
    url.searchParams.set("frame", frame.toString());
    url.searchParams.set("style", JSON.stringify(style));

    return url.href;
  }
  private cleanOldImages(url: string) {
    // delete images that match except for the style
    const styleStart = url.indexOf("style=");
    const search = url.slice(0, styleStart);

    Array.from(this.imageCache.keys()).forEach(key => {
      if (key !== url && key.startsWith(search)) {
        this.imageCache.delete(key);
      }
    });
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
        bins: 128,
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
      .then(r => r.data[0]); // TODO why is this an array?
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

  getDataset(id: string): Promise<IDataset> {
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
              ...parseTiles(images, tiles)
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
    data.set(
      "metadata",
      JSON.stringify({
        subtype: "contrastConfiguration",
        layers: [newLayer(dataset, [])]
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
        layers: config.layers
      })
      .then(() => config);
  }

  deleteConfiguration(
    config: IDatasetConfiguration
  ): Promise<IDatasetConfiguration> {
    return this.client.delete(`/item/${config.id}`).then(() => config);
  }

  private loadImage(
    url: string,
    width: number,
    height: number,
    mimeType: string
  ) {
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url)!;
    }
    // need to go through axios to have the right header flags
    const image = new Image(width, height);
    this.imageCache.set(url, image);

    // load and set the source when done
    this.client
      .get(url, {
        responseType: "arraybuffer"
      })
      .then(r => {
        const buffer = r.data as ArrayBuffer;
        const blob = new Blob([buffer], {
          type: mimeType
        });
        const blobUrl = URL.createObjectURL(blob);
        image.src = blobUrl;
      });

    return image;
  }

  generateImages(images: IImage[], color: string, contrast: IContrast) {
    const resolvedImages: IImageTile[] = [];
    let offsetX = 0;
    const offsetY = 0;

    const hist = this.getResolvedLayerHistogram(images);
    const style = toStyle(color, contrast, hist);

    images.forEach(image => {
      for (let x = 0; x < image.sizeX; x += image.tileWidth) {
        const w = Math.min(image.sizeX - x, image.tileWidth);
        for (let y = 0; y < image.sizeY; y += image.tileHeight) {
          const h = Math.min(image.sizeY - y, image.tileHeight);
          const loc = {
            x: x / image.tileWidth,
            y: y / image.tileHeight,
            z: image.levels - 1, // highest level for max zoom
            frame: image.frameIndex
          };
          const url = this.tileUrl(image.item, loc, style);
          this.cleanOldImages(url);

          resolvedImages.push({
            x: offsetX + x,
            y: offsetY + y,
            width: w,
            height: h,
            url,
            image: this.loadImage(
              url,
              image.tileWidth,
              image.tileHeight,
              "image/png"
            )
          });
        }
      }

      // since horizontal tiling only
      offsetX += image.sizeX;
    });

    return resolvedImages;
  }

  getLayerHistogram(images: IImage[]) {
    const key = images.map(i => `${i.item._id}#${i.frameIndex}`).join(",");
    if (this.histogramCache.has(key)) {
      return this.histogramCache.get(key)!;
    }

    const promise = Promise.all(
      images.map(image =>
        this.getHistogram(image.item, {
          frame: image.frameIndex,
          width: image.sizeX,
          height: image.sizeY
        })
      )
    ).then(histograms => mergeHistograms(histograms));
    this.histogramCache.set(key, promise);
    promise.then(hist => this.resolvedHistogramCache.set(key, hist));
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
    z: [],
    width: 100,
    height: 100,
    time: [],
    channels: [],
    images: () => [],
    configurations: []
  };
}

function asConfigurationItem(item: IGirderItem): IDatasetConfiguration {
  return {
    id: item._id,
    _girder: item,
    name: item.name,
    description: item.description,
    layers: item.meta.layers || []
  };
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

function toKey(t: number | string, z: number | string, c: number | string) {
  return `t${t}:z${z}:c${c}`;
}

function parseTiles(items: IGirderItem[], tiles: ITileMeta[]) {
  // t x z x c -> IImage[]
  const ts = new Set<number>();
  const zs = new Set<number>();
  const cs = new Set<number>();

  const lookup = new Map<string, IImage[]>();
  tiles.forEach((tile, i) => {
    const item = items[i]!;
    tile.frames.forEach((frame, j) => {
      const t = +frame.DeltaT;
      const z = +frame.PositionZ;
      const c = +frame.TheC;
      ts.add(t);
      zs.add(z);
      cs.add(c);
      const key = toKey(t, z, c);
      const info: IImage = {
        frame,
        levels: tile.levels,
        frameIndex: j,
        item,
        sizeX: tile.sizeX,
        sizeY: tile.sizeY,
        tileWidth: tile.tileWidth,
        tileHeight: tile.tileHeight
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

  // TODO better stiching for now just horizontally
  lookup.forEach(images => {
    const cwidth = images.reduce((acc, image) => acc + image.sizeX, 0);
    const cheight = images.reduce(
      (acc, image) => Math.max(acc, image.sizeY),
      0
    );
    if (cwidth > width) {
      width = cwidth;
    }
    if (cheight > height) {
      height = cheight;
    }
  });

  return {
    images: (time: number, z: number, channel: number) =>
      lookup.get(toKey(time, z, channel)) || [],
    z: Array.from(zs).sort((a, b) => a - b),
    channels: Array.from(cs).sort((a, b) => a - b),
    time: Array.from(ts).sort((a, b) => a - b),
    width,
    height
  };
}
