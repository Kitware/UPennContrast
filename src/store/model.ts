import { IGirderItem, IGirderFolder } from "@/girder";

export interface IDatasetConfigurationMeta {
  id: string;
  datasetId: string;
  datasetName: string;
  name: string;
  description: string;
}

export interface IFrameInfo {
  DeltaT: number;
  PositionX: number;
  PositionY: number;
  PositionZ: number;
  IndexXY: number;
  IndexZ: number;
  IndexC: number;
  IndexT: number;
}

export interface IImage {
  item: IGirderItem;
  levels: number;
  frameIndex: number;
  frame: IFrameInfo;
  sizeX: number;
  sizeY: number;
  tileWidth: number;
  tileHeight: number;
}

export interface IImageTile {
  x: number;
  y: number;
  width: number;
  height: number;
  frame: number;
  url: string;
  image: HTMLImageElement;
  fullImage: HTMLImageElement;
}

export interface IDataset {
  readonly id: string;
  readonly _girder: IGirderFolder;

  name: string;
  description: string;

  xy: number[];
  z: number[];
  time: number[][]; // number of time points, within a set of the time points that reflect valid z-time points
  // time for t,z -> time[t][z]
  channels: number[];
  channelNames: Map<number, string>;
  width: number;
  height: number;
  images(z: number, zTime: number, xy: number, channel: number): IImage[];
  anyImage(): IImage | null;

  configurations: IDatasetConfiguration[];
}

export interface IDatasetConfiguration {
  readonly id: string;
  readonly _girder: IGirderItem;

  name: string;
  description: string;

  layers: IDisplayLayer[];
}

export declare type DisplaySliceType =
  | "current"
  | "max-merge"
  | "constant"
  | "offset";

export interface IDisplaySlice {
  type: DisplaySliceType;
  value: number | null;
}

export interface IDisplayLayer {
  readonly id: string; // to have better keys for UI
  name: string;
  color: string;

  // TODO: boolean or which channel to use? why multiple allowed and how to combine
  channel: number;

  xy: IDisplaySlice;
  z: IDisplaySlice;
  time: IDisplaySlice;

  visible: boolean;

  contrast: IContrast;

  _histogram?: any | undefined;
}

export interface IContrast {
  mode: "percentile" | "absolute";
  blackPoint: number;
  whitePoint: number;
  savedBlackPoint: number;
  savedWhitePoint: number;
}

export interface IUISetting {
  dataset: Readonly<IDataset>;
  configuration: IDatasetConfiguration;
  z: number;
  time: number;
  activeLayer: IDisplayLayer;
}

export function isConfigurationItem(item: IGirderItem) {
  return item.meta.subtype === "contrastConfiguration";
}

export function isDatasetFolder(folder: IGirderFolder) {
  return folder.meta.subtype === "contrastDataset";
}

// Fallback colors for channels with unknown names or with duplicate colors.
// Keep the same uppercase/lowercase as the `channelColors` color values.
const colors = [
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF"
];

// keys should be all uppercase.  Values should have the same case as the
// `colors` list.
const channelColors: { [key: string]: string } = {
  BRIGHTFIELD: "#FFFFFF",
  DAPI: "#0000FF",
  A594: "#FF0000",
  CY3: "#FF8000", // orange
  CY5: "#FF00FF",
  YFP: "#00FF00",
  GFP: "#00FF00"
};

function randomId() {
  return Math.random()
    .toString(36)
    .substr(2, 5);
}

export function newLayer(
  dataset: IDataset,
  layers: IDisplayLayer[]
): IDisplayLayer {
  const usedColors = new Set(layers.map(l => l.color));
  const nextColor = colors.filter(c => !usedColors.has(c));
  const usedChannels = new Set(layers.map(l => l.channel));
  const nextChannel = dataset.channels
    .map((_, i) => i)
    .filter(c => !usedChannels.has(c));

  const channelName =
    dataset.channelNames.get(nextChannel[0] || 0) ||
    `Channel ${nextChannel[0] || 0}`;
  let channelColor = channelColors[channelName.toUpperCase()];
  if (!channelColor || usedColors.has(channelColor)) {
    channelColor = nextColor[0] || colors[0];
  }
  let layerName = channelName;
  if (layerName === "" || layers.some(l => l.name === layerName)) {
    layerName = `Layer ${layers.length + 1}`;
  }

  // guess a good new layer
  return {
    id: randomId(),
    name: layerName,
    visible: true,
    channel: nextChannel[0] || 0,
    time: {
      type: "current",
      value: null
    },
    xy: {
      type: "current",
      value: null
    },
    z: {
      type: "current",
      value: null
    },
    color: channelColor,
    contrast: {
      mode: "percentile",
      blackPoint: 0,
      savedBlackPoint: 0,
      whitePoint: 100,
      savedWhitePoint: 100
    }
  };
}
