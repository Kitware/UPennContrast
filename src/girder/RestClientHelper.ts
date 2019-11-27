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
  IImage
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
        const images = items.filter(d => (d as any).largeImage);
        return Promise.all(images.map(item => this.getTiles(item))).then(
          tiles => {
            return {
              ...asDataset(folder),
              configurations: items
                .filter(isConfigurationItem)
                .map(asConfigurationItem),
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

  updateConfiguration(
    config: IDatasetConfiguration
  ): Promise<IDatasetConfiguration> {
    const data = new FormData();
    data.set(
      "metaData",
      JSON.stringify({
        layerMode: config.layerMode,
        layers: config.layers
      })
    );
    return this.client
      .put(`/item/${config.id}/metadata`, data)
      .then(() => config);
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
    layers: item.meta.layers || [],
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

const example = {
  frames: [
    {
      DeltaT: "1239759.375000",
      ExposureTime: "3100.000000",
      PositionX: "27808.039063",
      PositionY: "38605.839844",
      PositionZ: "1905.224976",
      TheC: "0",
      TheT: "0",
      TheZ: "0"
    },
    {
      DeltaT: "1239759.375000",
      ExposureTime: "3100.000000",
      PositionX: "27808.039063",
      PositionY: "38605.839844",
      PositionZ: "1905.224976",
      TheC: "1",
      TheT: "0",
      TheZ: "0"
    },
    {
      DeltaT: "1239759.375000",
      ExposureTime: "3100.000000",
      PositionX: "27808.039063",
      PositionY: "38605.839844",
      PositionZ: "1905.224976",
      TheC: "2",
      TheT: "0",
      TheZ: "0"
    },
    {
      DeltaT: "1239759.375000",
      ExposureTime: "3100.000000",
      PositionX: "27808.039063",
      PositionY: "38605.839844",
      PositionZ: "1905.224976",
      TheC: "3",
      TheT: "0",
      TheZ: "0"
    },
    {
      DeltaT: "1239759.375000",
      ExposureTime: "3100.000000",
      PositionX: "27808.039063",
      PositionY: "38605.839844",
      PositionZ: "1905.224976",
      TheC: "4",
      TheT: "0",
      TheZ: "0"
    }
  ],
  levels: 3,
  magnification: 45.645426328281914,
  mm_x: 0.00021907999999999997,
  mm_y: 0.00021907999999999997,
  omeinfo: {
    Experimenter: { ID: "Experimenter:0", Institution: "", LastName: "" },
    Image: [
      {
        AcquisitionDate: "2019-07-21T15:26:39",
        Description:
          "Metadata:\nDimensions: XY(10) x Z(29) x \u03bb(5)\nCamera Name: Flash4.0, SN:302486\nNumerical Aperture: 1.4\nRefractive Index: 1.515\nNumber of Picture Planes: 5\nPlane #1:\n Name: Brightfield\n Component Count: 1\n Modality: Brightfield\n Camera Settings:   Exposure: 50 ms\n  Binning: 2x2\n  Scan Mode: Slow\n  Temperature: -10.0\u00b0C\n Microscope Settings:   Microscope: Ti Microscope\n  Nikon Ti, FilterChanger(Turret1): 2 (GFPHQ)\n  Nikon Ti, Shutter(EPI): Closed\n  Nikon Ti, Shutter(DIA): Closed\n  Nikon Ti, Illuminator(Illuminator-DIA): Remote Switch On\n  Nikon Ti, Illuminator(Illuminator-DIA): On\n  Nikon Ti, Illuminator(Illuminator-DIA) Voltage: 5.0\n  LightPath: R100\n  PFS-S, state: Off\n  PFS-S, offset: 6311\n  PFS-S, mirror: Inserted\n  PFS-S, mirror: Inserted\n  \n  Zoom: 1.00x\n  Sola II, Shutter(Sola): Closed\n  Sola II, Illuminator(Sola) Iris intensity: 0.0\nPlane #2:\n Name: CY3\n Component Count: 1\n Modality: Widefield Fluorescence\n Camera Settings:   Exposure: 1 s\n  Binning: 2x2\n  Scan Mode: Slow\n  Temperature: -10.0\u00b0C\n Microscope Settings:   Microscope: Ti Microscope\n  Nikon Ti, FilterChanger(Turret1): 4 (Cy3)\n  Nikon Ti, Shutter(EPI): Opened\n  Nikon Ti, Shutter(DIA): Closed\n  Nikon Ti, Illuminator(Illuminator-DIA): Remote Switch On\n  Nikon Ti, Illuminator(Illuminator-DIA): On\n  Nikon Ti, Illuminator(Illuminator-DIA) Voltage: 3.0\n  LightPath: R100\n  PFS-S, state: Off\n  PFS-S, offset: 6311\n  PFS-S, mirror: Inserted\n  PFS-S, mirror: Inserted\n  \n  Zoom: 1.00x\n  Sola II, Shutter(Sola): Closed\n  Sola II, Illuminator(Sola) Iris intensity: 100.0\nPlane #3:\n Name: A594\n Component Count: 1\n Modality: Widefield Fluorescence\n Camera Settings:   Exposure: 1 s\n  Binning: 2x2\n  Scan Mode: Slow\n  Temperature: -10.0\u00b0C\n Microscope Settings:   Microscope: Ti Microscope\n  Nikon Ti, FilterChanger(Turret1): 3 (A594)\n  Nikon Ti, Shutter(EPI): Opened\n  Nikon Ti, Shutter(DIA): Closed\n  Nikon Ti, Illuminator(Illuminator-DIA): Remote Switch On\n  Nikon Ti, Illuminator(Illuminator-DIA): On\n  Nikon Ti, Illuminator(Illuminator-DIA) Voltage: 3.0\n  LightPath: R100\n  PFS-S, state: Off\n  PFS-S, offset: 6311\n  PFS-S, mirror: Inserted\n  PFS-S, mirror: Inserted\n  \n  Zoom: 1.00x\n  Sola II, Shutter(Sola): Closed\n  Sola II, Illuminator(Sola) Iris intensity: 100.0\nPlane #4:\n Name: CY5\n Component Count: 1\n Modality: Widefield Fluorescence\n Camera Settings:   Exposure: 1 s\n  Binning: 2x2\n  Scan Mode: Slow\n  Temperature: -10.0\u00b0C\n Microscope Settings:   Microscope: Ti Microscope\n  Nikon Ti, FilterChanger(Turret1): 5 (Cy5)\n  Nikon Ti, Shutter(EPI): Opened\n  Nikon Ti, Shutter(DIA): Closed\n  Nikon Ti, Illuminator(Illuminator-DIA): Remote Switch On\n  Nikon Ti, Illuminator(Illuminator-DIA): On\n  Nikon Ti, Illuminator(Illuminator-DIA) Voltage: 3.0\n  LightPath: R100\n  PFS-S, state: Off\n  PFS-S, offset: 6311\n  PFS-S, mirror: Inserted\n  PFS-S, mirror: Inserted\n  \n  Zoom: 1.00x\n  Sola II, Shutter(Sola): Closed\n  Sola II, Illuminator(Sola) Iris intensity: 100.0\nPlane #5:\n Name: DAPI\n Component Count: 1\n Modality: Widefield Fluorescence\n Camera Settings:   Exposure: 50 ms\n  Binning: 2x2\n  Scan Mode: Slow\n  Temperature: -10.0\u00b0C\n Microscope Settings:   Microscope: Ti Microscope\n  Nikon Ti, FilterChanger(Turret1): 1 (DAPI)\n  Nikon Ti, Shutter(EPI): Opened\n  Nikon Ti, Shutter(DIA): Closed\n  Nikon Ti, Illuminator(Illuminator-DIA): Remote Switch Off\n  Nikon Ti, Illuminator(Illuminator-DIA): On\n  Nikon Ti, Illuminator(Illuminator-DIA) Voltage: 1.5\n  LightPath: R100\n  PFS-S, state: Off\n  PFS-S, offset: 6311\n  PFS-S, mirror: Inserted\n  PFS-S, mirror: Inserted\n  \n  Zoom: 1.00x\n  Sola II, Shutter(Sola): Closed\n  Sola II, Illuminator(Sola) Iris intensity: 100.0\nZ Stack Loop: 29\n- Step: 0.3 \u00b5m\n- Device: Ti ZDrive",
        ID: "Image:0",
        ImagingEnvironment: { Temperature: "-1.000000" },
        InstrumentRef: { ID: "Instrument:1" },
        Name:
          "C:\\Users\\arjunrajlab\\Documents\\Ben\\20190720_MemSeq_scan\\DDX58_AXL_EGFR_well2\\DDX58_AXL_EGFR_well2_XY08.ome.tif",
        Pixels: {
          Channel: [
            {
              ContrastMethod: "Brightfield",
              DetectorSettings: { Binning: "2x2", ID: "Detector:0" },
              EmissionWavelength: "540",
              ID: "Channel:0",
              Name: "Brightfield",
              PinholeSize: "-1.000000"
            },
            {
              AcquisitionMode: "WideField",
              Color: "16711680",
              DetectorSettings: { Binning: "2x2", ID: "Detector:0" },
              EmissionWavelength: "590",
              ID: "Channel:1",
              Name: "CY3",
              PinholeSize: "-1.000000"
            },
            {
              AcquisitionMode: "WideField",
              Color: "16711680",
              DetectorSettings: { Binning: "2x2", ID: "Detector:0" },
              ID: "Channel:2",
              Name: "A594",
              PinholeSize: "-1.000000"
            },
            {
              AcquisitionMode: "WideField",
              Color: "16711935",
              DetectorSettings: { Binning: "2x2", ID: "Detector:0" },
              EmissionWavelength: "670",
              ID: "Channel:3",
              Name: "CY5",
              PinholeSize: "-1.000000"
            },
            {
              AcquisitionMode: "WideField",
              Color: "255",
              DetectorSettings: { Binning: "2x2", ID: "Detector:0" },
              EmissionWavelength: "460",
              ID: "Channel:4",
              Name: "DAPI",
              PinholeSize: "-1.000000"
            }
          ],
          DimensionOrder: "XYCZT",
          ID: "Pixels:0",
          PhysicalSizeX: "0.219080",
          PhysicalSizeY: "0.219080",
          Plane: [
            {
              DeltaT: "1239759.375000",
              ExposureTime: "3100.000000",
              PositionX: "27808.039063",
              PositionY: "38605.839844",
              PositionZ: "1905.224976",
              TheC: "0",
              TheT: "0",
              TheZ: "0"
            },
            {
              DeltaT: "1239759.375000",
              ExposureTime: "3100.000000",
              PositionX: "27808.039063",
              PositionY: "38605.839844",
              PositionZ: "1905.224976",
              TheC: "1",
              TheT: "0",
              TheZ: "0"
            },
            {
              DeltaT: "1239759.375000",
              ExposureTime: "3100.000000",
              PositionX: "27808.039063",
              PositionY: "38605.839844",
              PositionZ: "1905.224976",
              TheC: "2",
              TheT: "0",
              TheZ: "0"
            },
            {
              DeltaT: "1239759.375000",
              ExposureTime: "3100.000000",
              PositionX: "27808.039063",
              PositionY: "38605.839844",
              PositionZ: "1905.224976",
              TheC: "3",
              TheT: "0",
              TheZ: "0"
            },
            {
              DeltaT: "1239759.375000",
              ExposureTime: "3100.000000",
              PositionX: "27808.039063",
              PositionY: "38605.839844",
              PositionZ: "1905.224976",
              TheC: "4",
              TheT: "0",
              TheZ: "0"
            }
          ],
          SizeC: "5",
          SizeT: "1",
          SizeX: "1024",
          SizeY: "1022",
          SizeZ: "1",
          TiffData: [
            {
              DeltaT: "1239759.375000",
              ExposureTime: "3100.000000",
              PositionX: "27808.039063",
              PositionY: "38605.839844",
              PositionZ: "1905.224976",
              TheC: "0",
              TheT: "0",
              TheZ: "0"
            },
            {
              DeltaT: "1239759.375000",
              ExposureTime: "3100.000000",
              PositionX: "27808.039063",
              PositionY: "38605.839844",
              PositionZ: "1905.224976",
              TheC: "1",
              TheT: "0",
              TheZ: "0"
            },
            {
              DeltaT: "1239759.375000",
              ExposureTime: "3100.000000",
              PositionX: "27808.039063",
              PositionY: "38605.839844",
              PositionZ: "1905.224976",
              TheC: "2",
              TheT: "0",
              TheZ: "0"
            },
            {
              DeltaT: "1239759.375000",
              ExposureTime: "3100.000000",
              PositionX: "27808.039063",
              PositionY: "38605.839844",
              PositionZ: "1905.224976",
              TheC: "3",
              TheT: "0",
              TheZ: "0"
            },
            {
              DeltaT: "1239759.375000",
              ExposureTime: "3100.000000",
              PositionX: "27808.039063",
              PositionY: "38605.839844",
              PositionZ: "1905.224976",
              TheC: "4",
              TheT: "0",
              TheZ: "0"
            }
          ],
          Type: "uint16"
        }
      }
    ],
    Instrument: [
      {
        ID: "Instrument:0",
        LightSource: [
          { ID: "LightSource:0", Laser: {} },
          { ID: "LightSource:1", Laser: {} },
          { ID: "LightSource:2", Laser: {} },
          { ID: "LightSource:3", Laser: {} },
          { ID: "LightSource:4", Laser: {} }
        ],
        Objective: {
          CalibratedMagnification: "1.000000",
          ID: "Objective:0",
          LensNA: "1.400000",
          NominalMagnification: "1"
        }
      },
      {
        Detector: { ID: "Detector:0" },
        Filter: [
          {
            ID: "Filter:0",
            Model: "Custom",
            TransmittanceRange: { CutOut: "1" },
            Type: "BandPass"
          },
          {
            ID: "Filter:1",
            Model: "Custom",
            TransmittanceRange: { CutOut: "1" },
            Type: "BandPass"
          },
          {
            ID: "Filter:2",
            Model: "Custom",
            TransmittanceRange: { CutOut: "1" },
            Type: "BandPass"
          },
          {
            ID: "Filter:3",
            Model: "Custom",
            TransmittanceRange: { CutOut: "1" },
            Type: "BandPass"
          },
          {
            ID: "Filter:4",
            Model: "Custom",
            TransmittanceRange: { CutOut: "1" },
            Type: "BandPass"
          }
        ],
        ID: "Instrument:1",
        Microscope: { Model: "Ti Microscope" },
        Objective: {
          Correction: "PlanApo",
          ID: "Objective:1",
          Immersion: "Oil",
          LensNA: "1.400000",
          Model: "Plan Apo \u03bb 60x Oil",
          NominalMagnification: "60",
          WorkingDistance: "130.000000"
        }
      }
    ],
    schemaLocation:
      "http://www.openmicroscopy.org/Schemas/OME/2015-01 http://www.openmicroscopy.org/Schemas/OME/2015-01/ome.xsd"
  },
  sizeX: 1024,
  sizeY: 1022,
  tileHeight: 256,
  tileWidth: 1024
};

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
