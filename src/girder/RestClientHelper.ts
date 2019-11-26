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
  isConfigurationItem
} from "@/store/model";

function toId(item: string | { _id: string }) {
  return typeof item === "string" ? item : item._id;
}

export default class RestClientHelper {
  private readonly client: RestClient;

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

  getImage(item: string | IGirderItem) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = evt => reject(evt);
      image.src = this.downloadUrl(item);
    });
  }

  tileUrl(
    item: string | IGirderItem,
    { x, y, z, frame }: { x: number; y: number; z: number; frame: number },
    style: ITileOptions
  ) {
    const url = new URL(
      `${this.client.apiRoot}/item/${toId(
        item
      )}/tiles/fzyx/${frame}/${z}/${x}/${y}`
    );
    url.searchParams.set("encoding", "PNG");
    url.searchParams.set("style", JSON.stringify(style));

    return url.href;
  }

  getTiles(item: string | IGirderItem): Promise<ITileMeta> {
    return this.client.get(`item/${toId(item)}/tiles`).then(r => r.data);
  }

  getHistogram(
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
      .then(r => r.data);
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
        // TODO derive from OME tiff data
        return {
          ...asDataset(folder),
          configurations: items
            .filter(isConfigurationItem)
            .map(asConfigurationItem)
        };
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
        subtype: "contrastConfiguration"
      })
    );
    return this.client
      .post("item", data)
      .then(r => asConfigurationItem(r.data));
  }
}

function asDataset(folder: IGirderFolder): IDataset {
  return {
    id: folder._id,
    _girder: folder,
    name: folder.name,
    description: folder.description,
    z: { min: 0, max: 1 },
    time: { min: 0, max: 1 },
    channels: [{ min: 0, max: 1 }],
    // images: items.filter(isImage).map(asImageItem),
    configurations: []
  };
}

function asConfigurationItem(item: IGirderItem): IDatasetConfiguration {
  return {
    id: item._id,
    _girder: item,
    name: item.name,
    description: item.description,
    layers: [], // TODO get from meta
    layerMode: item.meta.layerMode === "single" ? "single" : "multiple"
  };
}

export interface IHistogramOptions {
  frame: number;
  bins: number;
  width: number;
  height: number;
  resample: boolean;
}

export interface ITileHistogram {
  test: number[];
  min: number;
  max: number;
  // TODO
}

export interface ITileMeta {
  sizeX: number;
  sizeY: number;
  tileWidth: number;
  tileHeight: number;
  frames?: number[];
  // TODO
}

export interface ITileOptions {
  min: number | "auto" | "min" | "max";
  max: number | "auto" | "min" | "max";
  palette: string[]; // palette of hex colors, e.g. #000000
}

function k(steps: number, gamma: number) {
  const palette: string[] = [];
  for (let i = 0; i < steps; i++) {
    const s = i / (steps - 1);
    const d = s ? Math.pow(s, 1.0 / gamma) : 0;
    let hex = `0${Math.round(d * 255).toString(16)}`;
    hex = hex.substring(hex.length - 2);
    palette.push(`#${hex}${hex}${hex}`);
  }
}
