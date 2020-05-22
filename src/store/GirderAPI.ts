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
  wholeRegionUrl(
    item: string | IGirderItem,
    { frame }: { frame: number },
    style: ITileOptions
  ) {
    const url = new URL(
      `${this.client.apiRoot}/item/${toId(item)}/tiles/region`
    );
    url.searchParams.set("encoding", "PNG");
    url.searchParams.set("frame", frame.toString());
    url.searchParams.set("style", JSON.stringify(style));

    return url.href;
  }
  private cleanOldImages(url: string): HTMLImageElement | undefined {
    // delete images that match except for the style
    const styleStart = url.indexOf("style=");
    const search = url.slice(0, styleStart);

    let removed: HTMLImageElement | undefined;
    Array.from(this.imageCache.keys()).forEach(key => {
      if (key !== url && key.startsWith(search)) {
        removed = this.imageCache.get(key);
        this.imageCache.delete(key);
      }
    });
    return removed;
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
    splayXY: boolean,
    splayZ: boolean,
    splayT: boolean
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
              ...parseTiles(images, tiles, splayXY, splayZ, splayT)
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
        layers: config.layers.map(l =>
          Object.fromEntries(
            Object.entries(l).filter(([k]) => !k.startsWith("_"))
          )
        )
      })
      .then(() => config);
  }

  deleteConfiguration(
    config: IDatasetConfiguration
  ): Promise<IDatasetConfiguration> {
    return this.client.delete(`/item/${config.id}`).then(() => config);
  }

  private getFullImage(
    item: any,
    frame: any,
    width: number,
    height: number,
    hist: any,
    images: any
  ): HTMLImageElement {
    const key = `${item}|${frame}`;
    if (!this.fullImageCache.has(key)) {
      const image = new Image(width, height) as HTMLImageElementLocal;
      image._promise = () => {
        if (image.src && image.complete) {
          return null;
        }
        let promise;
        if (!hist) {
          promise = this.getLayerHistogram(images);
        } else {
          promise = Promise.resolve(hist);
        }
        return promise.then(hist => {
          let url = this.wholeRegionUrl(
            item,
            { frame: frame },
            toStyle(
              "#ffffff",
              {
                mode: "percentile",
                blackPoint: 0,
                whitePoint: 100,
                savedBlackPoint: 0,
                savedWhitePoint: 100
              },
              hist
            )
          );
          image.src = url;
          return image.decode();
        });
      };
      this.fullImageCache.set(key, image as HTMLImageElement);
    }
    return this.fullImageCache.get(key)!;
  }

  private loadImage(
    url: string,
    width: number,
    height: number,
    oldImage: HTMLImageElementLocal | undefined,
    hist: any,
    images: any,
    item: any,
    frame: any,
    color: string,
    contrast: IContrast
  ) {
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url)!;
    }
    const image = new Image(width, height) as HTMLImageElementLocal;

    // Keep the size of the cache under control.
    if (this.imageCache.size === 100) {
      const oldest = this.imageCache.entries().next().value[0];
      this.imageCache.delete(oldest);
    }

    this.imageCache.set(url, image);
    let promise: Promise<string>;
    if (!hist) {
      promise = this.getLayerHistogram(images).then(hist => {
        const style = toStyle(color, contrast, hist);
        url = this.wholeRegionUrl(item, { frame: frame }, style);
        return url;
      });
    } else {
      promise = Promise.resolve(url);
    }
    image._waitForHistogram = true;
    if (oldImage !== undefined && oldImage._waitForHistogram) {
      oldImage._waitForHistogram = false;
    }
    image._promise = () =>
      promise.then((url: string) => {
        if (!image._waitForHistogram) {
          return null;
        }
        let retVal: Promise<void> | null = null;
        image._waitForHistogram = false;

        if (oldImage !== undefined && !(oldImage.complete && oldImage.src)) {
          // if we emptied a value from the tracker, then attach an onload/onerror
          // event to that image that sets the source IFF this url is still in the
          // cache.  If it has fallen out of cache, call the onerror function.
          const previousOnload = oldImage.onload;
          const previousOnerror = oldImage.onerror;
          const localSetSource = (event: any) => {
            if (this.imageCache.get(url)) {
              image.src = url;
              retVal = image.decode();
            } else {
              if (image.onerror) {
                image.onerror(event);
              }
            }
          };
          oldImage.onload = event => {
            if (previousOnload) {
              previousOnload.call(oldImage, event);
            }
            localSetSource(event);
          };
          oldImage.onerror = event => {
            if (previousOnerror) {
              previousOnerror.call(oldImage, event);
            }
            localSetSource(event);
          };
        } else {
          // if the old image is resolved or not present, just set the src
          image.src = url;
          retVal = image.decode();
        }
        return retVal;
      });

    return image;
  }

  generateImages(images: IImage[], color: string, contrast: IContrast) {
    const resolvedImages: IImageTile[] = [];
    let offsetX = 0;
    let offsetY = 0;

    const hist = this.getResolvedLayerHistogram(images);
    const style = hist ? toStyle(color, contrast, hist) : "";

    const rowLength = Math.ceil(Math.sqrt(images.length));

    images.forEach((image, idx) => {
      /* This gets each tile separately, but since we get all of them this is
       * less efficient than just getting the entire image at once.  There is
       * some potential parallelization speed up, but its benefit is lost in
       * other inefficiencies.
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
              image.tileHeight
            )
          });
        }
      }
      */
      const url = this.wholeRegionUrl(
        image.item,
        { frame: image.frameIndex },
        style
      );
      const oldImage = this.cleanOldImages(url);

      resolvedImages.push({
        x: offsetX,
        y: offsetY,
        width: image.sizeX,
        height: image.sizeY,
        frame: image.frameIndex,
        url,
        image: this.loadImage(
          url,
          image.sizeX,
          image.sizeY,
          oldImage as HTMLImageElementLocal,
          hist,
          images,
          image.item,
          image.frameIndex,
          color,
          contrast
        ),
        fullImage: this.getFullImage(
          image.item,
          image.frameIndex,
          image.sizeX,
          image.sizeY,
          hist,
          images
        )
      });

      if ((idx + 1) % rowLength === 0) {
        offsetX = 0;
        offsetY += image.sizeY;
      } else {
        offsetX += image.sizeX;
      }
    });

    // TODO: since we merge histograms for multi-image layers, full-range
    // images can't use min/max as their defaults -- they need to be informed
    // by the histogram, too.
    Promise.map(
      resolvedImages,
      imgEntry => {
        const img = imgEntry.fullImage as HTMLImageElementLocal;
        return img._promise();
      },
      { concurrency: ImageConcurrency }
    );
    // we may want to chain these together to ensure that the full-range images
    // have all started before the styled images.  However, currently we only
    // redraw when a styled image arrives, so that would need to change.
    Promise.map(
      resolvedImages,
      imgEntry => {
        const img = imgEntry.image as HTMLImageElementLocal;
        return img._promise();
      },
      { concurrency: ImageConcurrency }
    );
    return resolvedImages;
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
          frame: image.frameIndex,
          width: image.sizeX,
          height: image.sizeY
        }),
      { concurrency: HistogramConcurrency }
    ).then((histograms: ITileHistogram[]) => mergeHistograms(histograms));
    this.histogramCache.set(key, promise);
    promise.then((hist: ITileHistogram) =>
      this.resolvedHistogramCache.set(key, hist)
    );
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
    width: 100,
    height: 100,
    time: [],
    channels: [],
    channelNames: new Map<number, string>(),
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
  zTime: number | string,
  xy: number | string,
  c: number | string
) {
  return `z${z}:t${zTime}:xy${xy}:c${c}`;
}

function parseTiles(
  items: IGirderItem[],
  tiles: ITileMeta[],
  splayXY: boolean,
  splayZ: boolean,
  splayT: boolean
) {
  // t x z x c -> IImage[]

  // z -> times
  const xys = new Set<number>();
  const zs = new Map<number, Set<number>>();
  const cs = new Set<number>();

  const channelInt = new Map<string | null, number>();
  const lookup = new Map<string, IImage[]>();
  let frameChannels: string[] | undefined;
  tiles.forEach((tile, i) => {
    const item = items[i]!;
    const metadata = getNumericMetadata(item.name);
    if (metadata.chan !== null && !channelInt.has(metadata.chan)) {
      channelInt.set(metadata.chan, channelInt.size);
    }

    frameChannels = tile.channels;

    tile.frames.forEach((frame, j) => {
      const t = splayT ? -1 : metadata.t !== null ? metadata.t : frame.IndexT;
      const xy = splayXY
        ? -1
        : metadata.xy !== null
        ? metadata.xy
        : frame.IndexXY || 0;
      const z = splayZ
        ? -1
        : metadata.z !== null
        ? metadata.z
        : frame.IndexZ !== undefined
        ? frame.IndexZ
        : frame.PositionZ;
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

  // Lay out images in a grid that is as roughly square as possible.
  //
  // TODO: this approach assumes all images have the same size.
  lookup.forEach(images => {
    const rowLength = Math.ceil(Math.sqrt(images.length));
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
  const zTime: number[][] = Array.from({ length: numberOfTimeSlots }).map(() =>
    zValues.slice()
  );

  entries.forEach(([k, v], i) => {
    zValues[i] = k;
    const tValues = Array.from(v).sort((a, b) => a - b);
    tValues.forEach((t, j) => {
      zTime[j][i] = t;
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
    images: (z: number, zTime: number, xy: number, channel: number) =>
      lookup.get(toKey(z, zTime, xy, channel)) || [],
    xy: Array.from(xys).sort((a, b) => a - b),
    z: zValues,
    time: zTime,
    channels,
    channelNames,
    width,
    height
  };
}
