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
  key: {
    z: number;
    xy: number;
    t: number;
    c: number;
  };
  keyOffset: number;
  frame: IFrameInfo;
  sizeX: number;
  sizeY: number;
  tileWidth: number;
  tileHeight: number;
  mm_x: number;
  mm_y: number;
  tileinfo: any;
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

export interface IToolTemplateInterface {
  id: string;
  name: string;
  type: string;
  meta: any;
}

export interface IToolTemplate {
  name: string;
  description: string;
  interface: IToolTemplateInterface[];
}

export interface IToolConfiguration {
  readonly id: string;
  readonly _girder: IGirderItem;

  name: string;
  description: string;

  type: string;

  values: any;

  template: IToolTemplate;

  configurationId: string;
  datasetId: string;
}

export interface IDataset {
  readonly id: string;
  readonly _girder: IGirderFolder;

  name: string;
  description: string;

  xy: number[];
  z: number[];
  time: number[];
  channels: number[];
  channelNames: Map<number, string>;
  width: number;
  height: number;
  images(z: number, zTime: number, xy: number, channel: number): IImage[];
  anyImage(): IImage | null;

  configurations: IDatasetConfiguration[];
}

export interface IViewConfiguration {
  layers: IDisplayLayer[];
}

export interface IToolSet {
  name: string;
  toolIds: string[];
}

export interface IDatasetConfiguration {
  readonly id: string;
  readonly _girder: IGirderItem;

  name: string;
  description: string;

  view: IViewConfiguration;
  toolset: IToolSet;

  snapshots?: any[];
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

export interface IGeoJSPoint {
  x: number;
  y: number;
}

export interface IWorkerInterface {
  [id: string]: {
    type: "number" | "text" | "tags" | "layer";
    min?: number;
    max?: number;
    default?: number;
  };
}

export enum AnnotationShape {
  Point = "point",
  Line = "line",
  Polygon = "polygon"
}

export const AnnotationNames = {
  [AnnotationShape.Point]: "Point",
  [AnnotationShape.Line]: "Line",
  [AnnotationShape.Polygon]: "Blob"
};

export interface IAnnotationLocation {
  XY: number;
  Z: number;
  Time: number;
}

export interface IAnnotation {
  id: string;
  tags: string[];
  name: string | null;
  channel: number;
  location: IAnnotationLocation;
  shape: AnnotationShape;
  coordinates: IGeoJSPoint[];
  datasetId: string;
}

export interface IAnnotationConnection {
  id: string;
  label: string;
  tags: string[];
  parentId: string;
  childId: string;
}

export interface IAnnotationFilter {
  id: string;
  exclusive: boolean;
  enabled: boolean;
}

export interface ITagAnnotationFilter extends IAnnotationFilter {
  tags: string[];
}

export interface IShapeAnnotationFilter extends IAnnotationFilter {
  shape: AnnotationShape;
}

export interface IPropertyAnnotationFilter extends IAnnotationFilter {
  propertyId: string;
  range: {
    min: number;
    max: number;
  };
  // Whether to exclude or include annotations that don't have the property
}

export interface IIdAnnotationFilter extends IAnnotationFilter {
  annotationIds: string[];
}

export interface IROIAnnotationFilter extends IAnnotationFilter {
  roi: IGeoJSPoint[];
}

export interface IAnnotationProperty {
  id: string;
  name: string;
  image: string;
  propertyType: "layer" | "morphology" | "relational";

  layer: number | null;
  tags: {
    tags: string[];
    exclusive: boolean;
  };
  independant: boolean;
  shape: AnnotationShape | null;
  customName: string | null;

  enabled: boolean;
  computed: boolean;
}

export interface IComputeJob {
  jobId: string;
  callback: (success: boolean) => void;
  datasetId: string;
}
export interface IAnnotationComputeJob extends IComputeJob {
  tool: IToolConfiguration;
}
export interface IPropertyComputeJob extends IComputeJob {
  propertyId: string;
  annotationIds: string[];
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
  "#00FFFF",
  "#FF8000",
  "#FF0080",
  "#00FF80",
  "#80FF00",
  "#8000FF",
  "#0080FF",
  "#FF8080",
  "#80FF80",
  "#8080FF",
  "#FFFF80",
  "#80FFFF",
  "#FF80FF",
  "#FF4000",
  "#FF0040",
  "#00FF40",
  "#40FF00",
  "#4000FF",
  "#0040FF",
  "#FF4040",
  "#40FF40",
  "#4040FF",
  "#FFFF40",
  "#40FFFF",
  "#FF40FF",
  "#FFC000",
  "#FF00C0",
  "#00FFC0",
  "#C0FF00",
  "#C000FF",
  "#00C0FF",
  "#FFC0C0",
  "#C0FFC0",
  "#C0C0FF",
  "#FFFFC0",
  "#C0FFFF",
  "#FFC0FF",
  "#FF8040",
  "#FF4080",
  "#40FF80",
  "#80FF40",
  "#8040FF",
  "#4080FF",
  "#FF80C0",
  "#FFC080",
  "#C0FF80",
  "#80FFC0",
  "#80C0FF",
  "#C080FF",
  "#FFC040",
  "#FF40C0",
  "#40FFC0",
  "#C0FF40",
  "#C040FF",
  "#40C0FF"
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
    channelColor = nextColor[0] || colors[layers.length % colors.length];
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

export enum AnnotationSelectionTypes {
  ADD = "ADD",
  TOGGLE = "TOGGLE",
  REMOVE = "REMOVE"
}

export const AnnotationSelectionTypesNames = {
  [AnnotationSelectionTypes.ADD]: "Add",
  [AnnotationSelectionTypes.TOGGLE]: "Toggle",
  [AnnotationSelectionTypes.REMOVE]: "Remove"
};

export const AnnotationSelectionTypesTooltips = {
  [AnnotationSelectionTypes.ADD]: "Add annotations to selection",
  [AnnotationSelectionTypes.TOGGLE]: "Toggle annotations selection",
  [AnnotationSelectionTypes.REMOVE]: "Remove annotation from selection"
};
