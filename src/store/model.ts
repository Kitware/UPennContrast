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

  const channelName = dataset.channelNames.get(nextChannel[0] || 0) || "";
  let channelColor = channelColors[channelName.toUpperCase()];
  if (!channelColor || usedColors.has(channelColor)) {
    channelColor = nextColor[0] || colors[0];
  }

  // guess a good new layer
  return {
    id: randomId(),
    name: `Layer ${layers.length + 1}`,
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

class CompositionModes {
  multiply =
    "The pixels are of the top layer are multiplied with the corresponding pixel of the bottom layer. A darker picture is the result.";
  screen =
    "The pixels are inverted, multiplied, and inverted again. A lighter picture is the result (opposite of multiply)";
  overlay =
    "A combination of multiply and screen. Dark parts on the base layer become darker; and light parts become lighter.";
  darken = "Retains the darkest pixels of both layers.";
  lighten = "Retains the lightest pixels of both layers.";
  lighter =
    "Where both shapes overlap the color is determined by adding color values.";
  difference =
    "Subtracts the bottom layer from the top layer or the other way round to always get a positive value.";
  exclusion = "Like difference, but with lower contrast.";
  hue =
    "Preserves the luma and chroma of the bottom layer, while adopting the hue of the top layer.";
  saturation =
    "Preserves the luma and hue of the bottom layer, while adopting the chroma of the top layer.";
  color =
    "Preserves the luma of the bottom layer, while adopting the hue and chroma of the top layer.";
  luminosity =
    "Preserves the hue and chroma of the bottom layer, while adopting the luma of the top layer.";
  "source-over" =
    "This is the default setting and draws new shapes on top of the existing canvas content.";
  "source-in" =
    "The new shape is drawn only where both the new shape and the destination canvas overlap. Everything else is made transparent.";
  "source-out" =
    "The new shape is drawn where it doesn't overlap the existing canvas content.";
  "source-atop" =
    "The new shape is only drawn where it overlaps the existing canvas content.";
  "destination-over" =
    "New shapes are drawn behind the existing canvas content.";
  "destination-in" =
    "The existing canvas content is kept where both the new shape and existing canvas content overlap. Everything else is made transparent.";
  "destination-out" =
    "The existing content is kept where it doesn't overlap the new shape.";
  "destination-atop" =
    "The existing canvas is only kept where it overlaps the new shape. The new shape is drawn behind the canvas content.";
  copy = "Only the new shape is shown.";
  xor =
    "Shapes are made transparent where both overlap and drawn normal everywhere else.";
  "color-dodge" = "Divides the bottom layer by the inverted top layer.";
  "color-burn" =
    "Divides the inverted bottom layer by the top layer, and then inverts the result.";
  "hard-light" =
    "A combination of multiply and screen like overlay, but with top and bottom layer swapped.";
  "soft-light" =
    "A softer version of hard-light. Pure black or white does not result in pure black or white.";
}

export declare type CompositionMode = keyof CompositionModes;
export const COMPOSITION_MODES = Object.entries(new CompositionModes());
