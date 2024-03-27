import { IGirderItem } from "@/girder";
import { ITileHistogram } from "./images";

export interface IHistoryEntry {
  actionName: string;
  isUndone: boolean;
  actionDate: Date;
}

export interface IFrameInfo {
  DeltaT: number;
  PositionX: number;
  PositionY: number;
  PositionZ: number;
  IndexXY?: number;
  IndexZ?: number;
  IndexC?: number;
  IndexT?: number;
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
  tileinfo: ITileMeta;
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

// see templates.json
export type TToolType =
  | "create"
  | "snap"
  | "select"
  | "connection"
  | "edit"
  | "segmentation"
  | "samAnnotation";

export interface IToolTemplateInterface {
  id: string;
  name: string;
  type: string;
  meta: any;
}

export interface IToolTemplate {
  name: string;
  type: TToolType;
  description: string;
  interface: IToolTemplateInterface[];
  shortName?: string;
}

export interface IToolConfiguration<Type extends TToolType = TToolType> {
  readonly id: string;
  name: string;
  hotkey: string | null;
  type: Type;
  values: any;
  template: IToolTemplate;
}

export const BaseToolStateSymbol: unique symbol = Symbol("BaseToolState");

export type TBaseToolStateSymbol = typeof BaseToolStateSymbol;

export interface IBaseToolState {
  type: TBaseToolStateSymbol;
}

export enum PromptType {
  backgroundPoint,
  foregroundPoint,
  box,
}

export interface ISamForegroundPointPrompt {
  type: PromptType.foregroundPoint;
  point: IGeoJSPoint;
}

export interface ISamBackgroundPointPrompt {
  type: PromptType.backgroundPoint;
  point: IGeoJSPoint;
}

export interface ISamBoxPrompt {
  type: PromptType.box;
  topLeft: IGeoJSPoint;
  bottomRight: IGeoJSPoint;
}

export type TSamPrompt =
  | ISamForegroundPointPrompt
  | ISamBackgroundPointPrompt
  | ISamBoxPrompt;

export const SamAnnotationToolStateSymbol: unique symbol = Symbol(
  "SamAnnotationToolState",
);

export type TSamAnnotationToolStateSymbol = typeof SamAnnotationToolStateSymbol;

export interface ISamAnnotationToolState {
  type: TSamAnnotationToolStateSymbol;
  nodes: {
    input: {
      geoJSMap: ManualInputNode<IMapEntry | TNoOutput>;
      mainPrompt: ManualInputNode<TSamPrompt[] | TNoOutput>;
      previewPrompt: ManualInputNode<TSamPrompt[] | TNoOutput>;
    };
    output: {
      mainOuput: OutputNode<IGeoJSPoint[]>;
      previewOuput: OutputNode<IGeoJSPoint[]>;
    };
  };
  mouseState: {
    path: IXYPoint[]; // In GCS coordinates
  };
  output: IGeoJSPoint[] | null;
  livePreview: IGeoJSPoint[] | null;
}

export interface IMouseState {
  mapEntry: IMapEntry;
  target: HTMLElement;
  path: IGeoJSPoint[];
  initialMouseEvent: MouseEvent;
}

export const ErrorToolStateSymbol: unique symbol = Symbol("ErrorToolState");

export type TErrorToolStateSymbol = typeof ErrorToolStateSymbol;

export interface IErrorToolState {
  type: TErrorToolStateSymbol;
  error?: Error;
}

interface IExplicitToolStateMap {
  samAnnotation: ISamAnnotationToolState | IErrorToolState;
}

type TFullToolStateMap = {
  [toolType in TToolType]: toolType extends keyof IExplicitToolStateMap
    ? IExplicitToolStateMap[toolType]
    : IBaseToolState;
};

export type TToolState<T extends TToolType = TToolType> = TFullToolStateMap[T];

export interface IActiveTool<T extends TToolType = TToolType> {
  configuration: IToolConfiguration<T>;
  state: TToolState<T>;
}

export interface IRestrictTagsAndLayer {
  tags: string[];
  tagsInclusive: boolean;
  layerId: string | null;
}

export interface IDataset {
  readonly id: string;

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
  allImages: IImage[];
}

export interface IViewConfiguration {
  layers: IDisplayLayer[];
}

export type TLayerMode = "single" | "multiple" | "unroll";

export interface IDownloadParameters {
  encoding: string;
  contentDisposition: string;
  contentDispositionFilename: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  jpeqQuality?: number;
  style?: string;
  tiffCompression?: string;
}

export interface ISnapshot {
  name: string;
  description: string;
  tags: string[];
  created: any;
  modified: number;
  viewport: {
    tl: any;
    tr: any;
    bl: any;
    br: any;
  };
  rotation: any;
  unrollXY: boolean;
  unrollZ: boolean;
  unrollT: boolean;
  xy: number;
  z: number;
  time: number;
  layerMode: TLayerMode;
  layers: IDisplayLayer[];
  screenshot: {
    format: string;
    bbox: IGeoJSBounds;
  };
}

export type IDimensionCompatibility = "one" | "multiple";

export type TUnitLength = "nm" | "µm" | "mm" | "m";
export const unitLengthOptions: TUnitLength[] = ["nm", "µm", "mm", "m"];
export type TUnitTime = "ms" | "s" | "m" | "h" | "d";
export const unitTimeOptions: TUnitTime[] = ["ms", "s", "m", "h", "d"];

export interface IScaleInformation<TUnit> {
  value: number;
  unit: TUnit;
}

export interface IScales {
  pixelSize: IScaleInformation<TUnitLength>;
  zStep: IScaleInformation<TUnitLength>;
  tStep: IScaleInformation<TUnitTime>;
}

export interface IDatasetConfigurationCompatibility {
  xyDimensions: IDimensionCompatibility;
  zDimensions: IDimensionCompatibility;
  tDimensions: IDimensionCompatibility;
  channels: { [key: number]: string };
}

export interface IDatasetConfigurationBase {
  compatibility: IDatasetConfigurationCompatibility;
  layers: IDisplayLayer[];
  tools: IToolConfiguration[];
  snapshots: ISnapshot[];
  propertyIds: string[];
  scales: IScales;
}

export interface IDatasetConfiguration extends IDatasetConfigurationBase {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export interface IDatasetViewBase {
  datasetId: string;
  configurationId: string;
  layerContrasts: {
    [layerId: string]: IContrast;
  };
  scales: Partial<IScales>;
  lastViewed: number;
}

export interface IDatasetView extends IDatasetViewBase {
  readonly id: string;
}

export type TDisplaySliceType = "current" | "max-merge" | "constant" | "offset";

export interface IDisplaySlice {
  type: TDisplaySliceType;
  value: number | null;
}

export interface IDisplayLayer {
  readonly id: string; // to have better keys for UI
  name: string;
  color: string;

  channel: number;

  xy: IDisplaySlice;
  z: IDisplaySlice;
  time: IDisplaySlice;

  visible: boolean;

  contrast: IContrast;

  layerGroup: string | null;

  _histogram?: {
    promise: Promise<null | ITileHistogram>;
    lastHistogram: null | ITileHistogram;
    lastImages: IImage[] | null;
    nextImages: IImage[] | null;
    lock: boolean;
  };
}

export interface ICombinedLayer {
  layer: IDisplayLayer; // configurationLayer + contrast override from datasetView
  configurationLayer: IDisplayLayer; // layer as saved in configuration item
}

export interface IPixel {
  l?: number;
  value?: number[];
}

// https://opengeoscience.github.io/geojs/apidocs/geo.object.html
export interface IGeoJsObject {
  modified: () => IGeoJsObject;
  geoOn: (event: string, handler: (event: any) => any) => IGeoJsObject;
  geoOff: (event: string, handler: (event: any) => any) => IGeoJsObject;
}

// https://opengeoscience.github.io/geojs/apidocs/geo.sceneObject.html
export interface IGeoJsSceneObject extends IGeoJsObject {}

// https://opengeoscience.github.io/geojs/apidocs/geo.mapInteractor.html#.spec
export interface IGeoJSMapInteractorSpec {
  keyboard?: {
    actions?: { [actionKey: string]: string[] };
    meta?: object;
    metakeyMouseEvents?: string[];
    focusHighlight?: boolean;
  };
}

// https://opengeoscience.github.io/geojs/apidocs/geo.mapInteractor.html
export interface IGeoJSMapInteractor extends IGeoJsObject {
  options: ((opt: IGeoJSMapInteractorSpec) => IGeoJSMapInteractor) &
    (() => IGeoJSMapInteractorSpec);
}

// https://opengeoscience.github.io/geojs/apidocs/geo.html#.geoBounds
export interface IGeoJSBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

type TGeoJSScreenShotTypes = "image/png" | "canvas";

// https://opengeoscience.github.io/geojs/apidocs/geo.map.html
export interface IGeoJSMap extends IGeoJsSceneObject {
  interactor: ((arg: IGeoJSMapInteractor) => IGeoJSMap) &
    (() => IGeoJSMapInteractor);
  bounds: (bds?: IGeoJSBounds, gcs?: string | null) => IGeoJSBounds;
  center: ((
    coordinates: IGeoJSPoint,
    gcs?: string | null,
    ignoreDiscreteZoom?: boolean,
    ignoreClampBounds?: boolean | "limited",
  ) => IGeoJSMap) &
    (() => IGeoJSPoint);
  createLayer: <T extends string>(
    layerName: T,
    arg?: object,
  ) => T extends "osm"
    ? IGeoJSOsmLayer
    : T extends "annotation"
      ? IGeoJSAnnotationLayer
      : T extends "feature"
        ? IGeoJSFeatureLayer
        : T extends "ui"
          ? IGeoJSUiLayer
          : IGeoJSLayer;
  deleteLayer: (layer: IGeoJSLayer | null) => IGeoJSLayer;
  displayToGcs: ((c: IGeoJSPoint, gcs?: string | null) => IGeoJSPoint) &
    ((c: IGeoJSPoint[], gcs?: string | null) => IGeoJSPoint[]);
  draw: () => IGeoJSMap;
  exit: () => void;
  gcs: ((arg: string) => IGeoJSMap) & (() => string);
  gcsToDisplay: ((c: IGeoJSPoint, gcs?: string | null) => IGeoJSPoint) &
    ((c: IGeoJSPoint[], gcs?: string | null) => IGeoJSPoint[]);
  geoOn: (event: string, handler: Function) => IGeoJSMap;
  geoOff: (
    event?: string | string[],
    arg?: Function | Function[] | null,
  ) => IGeoJSMap;
  ingcs: ((arg: string) => IGeoJSMap) & (() => string);
  layers: () => IGeoJSLayer[];
  maxBounds: ((bounds: IGeoJSBounds, gcs?: string | null) => IGeoJSMap) &
    ((bounds: undefined, gcs?: string | null) => IGeoJSBounds);
  node: () => JQuery;
  rotation: ((
    rotation: number,
    origin?: object,
    ignoreRotationFunc?: boolean,
  ) => IGeoJSMap) &
    (() => number);
  screenshot: <Type extends TGeoJSScreenShotTypes = "image/png">(
    layers: IGeoJSLayer | IGeoJSLayer[] | false | object | undefined,
    type?: Type,
    encoderOptions?: number,
    opts?: object,
  ) => Promise<Type extends "canvas" ? HTMLCanvasElement : string>;
  size: ((arg: IGeoScreenSize) => IGeoJSMap) & (() => IGeoScreenSize);
  unitsPerPixel: ((zoom: number, unit: number) => IGeoJSMap) &
    ((zoom?: number, unit?: null) => number);
  zoom: ((
    val: number,
    origin?: object,
    ingoreDiscreteZoom?: boolean,
    ignoreClampBounds?: boolean,
  ) => IGeoJSMap) &
    (() => number);
  zoomRange: ((
    arg: { min?: number; max?: number },
    noRefresh?: boolean,
  ) => IGeoJSMap) &
    (() => { min: number; max: number });
}

// https://opengeoscience.github.io/geojs/apidocs/geo.html#.screenSize
export interface IGeoScreenSize {
  width: number;
  height: number;
}

// https://opengeoscience.github.io/geojs/apidocs/geo.layer.html
export interface IGeoJSLayer extends IGeoJsObject {
  visible: (value?: boolean) => boolean | IGeoJSLayer;
  draw: () => IGeoJSLayer;
  map: () => IGeoJSMap;
  modes: {
    edit: "edit";
    cursor: "cursor";
  };
  node: () => JQuery<HTMLDivElement>;
  moveToTop: () => void;
  zIndex: (index?: number, allowDuplicate?: boolean) => number | IGeoJSLayer;
  currentAnnotation: null | IGeoJSAnnotation;
}

// https://opengeoscience.github.io/geojs/apidocs/geo.annotationLayer.html
export interface IGeoJSAnnotationLayer extends IGeoJSLayer {
  addAnnotation: (
    annotation: IGeoJSAnnotation,
    gcs?: string | null,
    update?: boolean,
  ) => IGeoJSAnnotationLayer;
  removeAnnotation: (annotation: IGeoJSAnnotation, update?: boolean) => boolean;
  annotations: () => IGeoJSAnnotation[];
  mode: (
    arg?: string | null,
    editAnnotation?: IGeoJSAnnotation,
  ) => string | null | IGeoJSAnnotationLayer;
}

// https://opengeoscience.github.io/geojs/apidocs/geo.html#.point2D
export interface IXYPoint {
  x: number;
  y: number;
}

// https://opengeoscience.github.io/geojs/apidocs/geo.html#.worldPosition
// https://opengeoscience.github.io/geojs/apidocs/geo.html#.geoPosition
export interface IGeoJSPoint extends IXYPoint {
  z?: number; // Optional z coordinate
}

// https://opengeoscience.github.io/geojs/apidocs/geo.fetchQueue.html
export interface IGeoJSFetchQueue {}

// https://opengeoscience.github.io/geojs/apidocs/geo.tile.html
export interface IGeoJSTile {
  index: {
    x: number;
    y: number;
    level?: number;
    reference?: number;
  };
  size: IXYPoint;
}

// https://opengeoscience.github.io/geojs/apidocs/geo.quadFeature.html#.position
export interface IGeoJSQuad {
  crop: IGeoJSPoint & IGeoJSBounds;
  lr: IGeoJSPoint;
  ul: IGeoJSPoint;
}

// https://opengeoscience.github.io/geojs/apidocs/geo.renderer.html
export interface IGeoJSRenderer extends IGeoJsObject {
  _maxTextureSize: number;
  constructor: Function & { _maxTextureSize: number };
}

// https://opengeoscience.github.io/geojs/apidocs/geo.osmLayer.html
export interface IGeoJSOsmLayer extends IGeoJSLayer {
  readonly idle: boolean;
  queue: IGeoJSFetchQueue;
  displayToLevel: (pt?: IXYPoint, zoom?: number) => IXYPoint;
  renderer: () => IGeoJSRenderer | null;
  reset: () => IGeoJSOsmLayer;
  tileAtPoint: (point: IXYPoint, level: number) => IXYPoint;
  url: (url?: string | ((...args: any[]) => string)) => string;

  onIdle: (handler: () => void) => IGeoJSOsmLayer;

  _imageUrls?: (string | undefined)[];
  _tileBounds: (tile: IGeoJSTile) => IGeoJSBounds;
  _options?: {
    minLevel?: number;
    maxLevel?: number;
  };

  baseQuad?: null | IGeoJSQuad;
  setFrameQuad?: ((frame: number) => void) & { status?: ISetQuadStatus };
}

// https://opengeoscience.github.io/geojs/apidocs/geo.feature.html
export interface IGeoJSFeature extends IGeoJSFeatureBase<IGeoJSFeature> {}
export interface IGeoJSFeatureBase<ThisType> extends IGeoJsSceneObject {
  data: ((arg: any[]) => ThisType) & (() => any[]);
  draw: (arg?: object) => ThisType;
  style: (() => object) &
    ((arg1: string) => object) &
    ((arg1: string, arg2: object) => ThisType) &
    ((arg1: object) => ThisType);
}

// https://opengeoscience.github.io/geojs/apidocs/geo.textFeature.html
export interface IGeoJSTextFeature
  extends IGeoJSFeatureBase<IGeoJSTextFeature> {
  position: ((
    val: IGeoJSPoint[] | ((dataPoint: any) => IGeoJSPoint),
  ) => IGeoJSTextFeature) &
    (() => IGeoJSPoint[] | ((dataPoint: any) => IGeoJSPoint));
}

// https://opengeoscience.github.io/geojs/apidocs/geo.featureLayer.html
export interface IGeoJSFeatureLayer extends IGeoJSLayer {
  readonly idle: boolean;
  createFeature: <T extends string>(
    featureName: T,
    arg?: object,
  ) => T extends "text" ? IGeoJSTextFeature : IGeoJSFeature;
  deleteFeature: (feature: IGeoJSFeature) => IGeoJSFeatureLayer;
  geoOn: (event: string, handler: Function) => IGeoJSFeatureLayer;
  geoOff: (
    event?: string | string[],
    arg?: Function | Function[] | null,
  ) => IGeoJSFeatureLayer;
  renderer: () => IGeoJSRenderer | null;
  features: (() => IGeoJSFeature[]) &
    ((val: IGeoJSFeature[]) => IGeoJSFeatureLayer);

  onIdle: (handler: () => void) => IGeoJSFeatureLayer;

  baseQuad?: null | IGeoJSQuad;
  setFrameQuad?: ((frame: number) => void) & { status?: ISetQuadStatus };
}

// https://opengeoscience.github.io/geojs/apidocs/geo.gui.widget.html
export interface IGeoJSWidget {}

// https://opengeoscience.github.io/geojs/apidocs/geo.gui.scaleWidget.html
export interface IGeoJSScaleWidget {
  options: (() => object) &
    (<Key extends IGeoJSScaleWidgetOptions>(
      arg1: Key,
    ) => IGeoJSScaleWidgetSpec[Key]) &
    (<Key extends IGeoJSScaleWidgetOptions>(
      arg1: Key,
      arg2: IGeoJSScaleWidgetSpec[Key],
    ) => IGeoJSScaleWidget);
  parent: (() => IGeoJsSceneObject) &
    ((arg: IGeoJsSceneObject) => IGeoJSScaleWidget);
  parentCanvas: () => HTMLElement;
  layer: () => IGeoJSUiLayer;
}

// https://opengeoscience.github.io/geojs/apidocs/geo.gui.scaleWidget.html#.spec
interface IGeoJSScaleWidgetSpec {
  scale: number;
}

type IGeoJSScaleWidgetOptions = keyof IGeoJSScaleWidgetSpec;

// https://opengeoscience.github.io/geojs/apidocs/geo.gui.uiLayer.html
export interface IGeoJSUiLayer extends IGeoJSLayer {
  createWidget: <WidgetName extends string, ParentType extends IGeoJsObject>(
    widgetName: WidgetName,
    arg: { parent?: ParentType; [k: string]: any },
  ) => WidgetName extends "scale" ? IGeoJSScaleWidget : IGeoJSWidget;
  deleteWidget: (widget: IGeoJSWidget) => IGeoJSUiLayer;
}

// https://opengeoscience.github.io/geojs/apidocs/geo.annotation.html
export interface IGeoJSAnnotation {
  options: (key?: string, value?: any) => any;
  style: (value?: { [key: string]: any }) => any;
  coordinates: () => IGeoJSPoint[];
  geojson: () => any;
}

// https://opengeoscience.github.io/geojs/apidocs/geo.html#.mouseState
export interface IGeoJSMouseState {
  page: IXYPoint;
  map: IGeoJSPoint;
  geo: IGeoJSPoint;
  mapgcs: IGeoJSPoint;
  buttons: {
    left: boolean;
    right: boolean;
    middle: boolean;
  };
  modifiers: {
    alt: boolean;
    ctrl: boolean;
    shift: boolean;
    meta: boolean;
  };
  time: number;
  deltaTime: number;
  velocity: IXYPoint;
}

// https://opengeoscience.github.io/geojs/apidocs/geo.polygonFeature.html#.styleSpec
export interface IGeoJSPolygonFeatureStyle {
  fill?: boolean | (() => boolean);
  fillColor?: string | (() => string);
  fillOpacity?: number | (() => number);
  stroke?: boolean | (() => boolean);
  uniformPolygon?: boolean | (() => boolean);
  closed?: boolean | (() => boolean);
  origin?: Array<number> | (() => Array<number>);
  strokeColor?: string | (() => string);
  strokeOpacity?: number | (() => number);
  strokeWidth?: number | (() => number);
  strokeOffset?: number | (() => number);
  lineCap?: string | (() => string);
  lineJoin?: string | (() => string);
  miterLimit?: number | (() => number);
  uniformLine?: boolean | string | (() => boolean | string);
  antialiasing?: number | (() => number);
  debug?: string | (() => string);
}

// https://opengeoscience.github.io/geojs/apidocs/geo.pointFeature.html#.styleSpec
export interface IGeoJSPointFeatureStyle {
  radius?: number | (() => number);
  stroke?: boolean | (() => boolean);
  strokeColor?: string | (() => string);
  strokeOpacity?: number | (() => number);
  strokeWidth?: number | (() => number);
  fill?: boolean | (() => boolean);
  fillColor?: string | (() => string);
  fillOpacity?: number | (() => number);
  origin?: Array<number> | (() => Array<number>);
  scaled?: boolean | number | (() => boolean | number); // missing from the documentation
}

// https://opengeoscience.github.io/geojs/apidocs/geo.lineFeature.html#.styleSpec
export interface IGeoJSLineFeatureStyle {
  strokeColor?: string | (() => string);
  strokeOpacity?: number | (() => number);
  strokeWidth?: number | (() => number);
  strokeOffset?: number | (() => number);
  lineCap?: string | (() => string);
  lineJoin?: string | (() => string);
  closed?: boolean | (() => boolean);
  miterLimit?: number | (() => number);
  uniformLine?: boolean | string | (() => boolean | string);
  antialiasing?: number | (() => number);
  debug?: string | (() => string);
  origin?: Array<number> | (() => Array<number>);
}

export interface ICommonWorkerInterfaceElement {
  vueAttrs?: { [vueAttr: string]: any };
}

export interface INumberWorkerInterfaceElement
  extends ICommonWorkerInterfaceElement {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
  default?: number;
}

export interface ITextWorkerInterfaceElement
  extends ICommonWorkerInterfaceElement {
  type: "text";
  default?: string;
}

export interface ITagsWorkerInterfaceElement
  extends ICommonWorkerInterfaceElement {
  type: "tags";
  default?: string[];
}

export interface ILayerWorkerInterfaceElement
  extends ICommonWorkerInterfaceElement {
  type: "layer";
  default?: string | null;
  required?: boolean;
}

export interface ISelectWorkerInterfaceElement
  extends ICommonWorkerInterfaceElement {
  type: "select";
  items: string[];
  default?: string;
  required?: boolean;
}

export interface IChannelWorkerInterfaceElement
  extends ICommonWorkerInterfaceElement {
  type: "channel";
  default?: number;
  required?: boolean;
}

export interface ICheckboxWorkerInterfaceElement
  extends ICommonWorkerInterfaceElement {
  type: "checkbox";
  default?: boolean;
}

export type TWorkerInterfaceElement =
  | INumberWorkerInterfaceElement
  | ITextWorkerInterfaceElement
  | ITagsWorkerInterfaceElement
  | ILayerWorkerInterfaceElement
  | ISelectWorkerInterfaceElement
  | IChannelWorkerInterfaceElement
  | ICheckboxWorkerInterfaceElement;

export type TWorkerInterfaceType = TWorkerInterfaceElement["type"];

// TWorkerInterfaceElement["default"] can be undefined because it is optional
// A value can't be undefined
// but it can be null when "required" field is false
export type TWorkerInterfaceValue = Exclude<
  TWorkerInterfaceElement["default"],
  undefined
> | null;

export interface IWorkerInterface {
  [id: string]: TWorkerInterfaceElement;
}

export interface IWorkerInterfaceValues {
  [id: string]: TWorkerInterfaceValue;
}

export interface IWorkerLabels {
  isUPennContrastWorker: string;
  isAnnotationWorker?: string;
  isPropertyWorker?: string;
  interfaceName?: string;
  interfaceCategory?: string;
  annotationShape?: AnnotationShape;
  description?: string;
}

export interface IWorkerImageList {
  [image: string]: IWorkerLabels;
}

export enum AnnotationShape {
  Point = "point",
  Line = "line",
  Polygon = "polygon",
}

export const AnnotationNames = {
  [AnnotationShape.Point]: "Point",
  [AnnotationShape.Line]: "Line",
  [AnnotationShape.Polygon]: "Blob",
};

export interface IAnnotationLocation {
  XY: number;
  Z: number;
  Time: number;
}

export interface IAnnotationBase {
  tags: string[];
  shape: AnnotationShape;
  channel: number;
  location: IAnnotationLocation;
  coordinates: IGeoJSPoint[];
  datasetId: string;
  color?: string;
}

export interface IAnnotation extends IAnnotationBase {
  id: string;
  name: string | null;
}

export interface IAnnotationConnectionBase {
  label: string;
  tags: string[];
  parentId: string;
  childId: string;
  datasetId: string;
}

export interface IAnnotationConnection extends IAnnotationConnectionBase {
  id: string;
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
  propertyPath: string[];
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

export interface IAnnotationPropertyConfiguration {
  name: string;
  image: string;

  tags: {
    tags: string[];
    exclusive: boolean;
  };
  shape: AnnotationShape;
  workerInterface: IWorkerInterfaceValues;
}

export interface IAnnotationProperty extends IAnnotationPropertyConfiguration {
  id: string;
}

export type TNestedValues<T> = T | { [pathName: string]: TNestedValues<T> };

export interface IAnnotationPropertyValues {
  [annotationId: string]: {
    [propertyId: string]: TNestedValues<number>;
  };
}

export type TPropertyHistogram = {
  count: number;
  min: number;
  max: number;
}[];

export interface ISerializedData {
  annotations: IAnnotation[];
  annotationConnections: IAnnotationConnection[];
  annotationProperties: IAnnotationProperty[];
  annotationPropertyValues: IAnnotationPropertyValues;
}

export interface IJobEventData {
  title?: string;
  text?: string;
  status?: number;
}

export interface IProgressInfo {
  title?: string;
  info?: string;
  progress?: number;
}

export interface ICameraInfo {
  center: IGeoJSPoint;
  zoom: number;
  rotate: number;
  gcsBounds: IGeoJSPoint[];
}

export type TJobType =
  | "large_image_cache_histograms"
  | "large_image_cache_tile_frames"
  | "large_image_tiff";

export interface IComputeJob {
  jobId: string;
  callback: (success: boolean) => void;
  datasetId: string | null;
  eventCallback?: (data: IJobEventData) => void;
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
}

export interface IUISetting {
  dataset: Readonly<IDataset>;
  configuration: IDatasetConfiguration;
  z: number;
  time: number;
  activeLayer: IDisplayLayer;
}

// https://opengeoscience.github.io/geojs/apidocs/geo.util.html#.pixelCoordinateParams
interface IGeoJSPixelCoordinateParams {
  map: {
    node: HTMLElement;
    ingcs: string;
    gcs: string;
    maxBounds: IGeoJSBounds;
    unitsPerPixel: number;
    center: IXYPoint;
    min: number;
    max: number;
    zoom: number;
    clampBoundsX: boolean;
    clampBoundsY: boolean;
    clampZoom: boolean;
  };
  layer: {
    maxLevel: number;
    wrapX: boolean;
    wrapY: boolean;
    tileOffset: () => IXYPoint;
    attribution: string;
    tileWidth: number;
    tileHeight: number;
    tileRounding: (x: number) => number;
    tilesAtZoom: (zoom: number) => IXYPoint | undefined;
    tilesMaxBounds: (level: number) => IXYPoint | undefined;
    renderer?: string;
    queue?: IGeoJSFetchQueue;
  };
}

export interface IMapEntry {
  map: IGeoJSMap;
  imageLayers: IGeoJSOsmLayer[];
  params: IGeoJSPixelCoordinateParams;
  baseLayerIndex: number | undefined;
  annotationLayer: IGeoJSAnnotationLayer;
  workerPreviewLayer: IGeoJSFeatureLayer;
  workerPreviewFeature: IGeoJSFeature;
  textLayer: IGeoJSFeatureLayer;
  uiLayer?: IGeoJSUiLayer;
  lowestLayer?: number;
}

export interface IQuadQuery {
  alignment?: number;
  format?: string;
  frameBase?: number;
  frameGroup?: number;
  frameGroupFactor?: number;
  frameGroupStride?: number;
  frameStride?: number;
  maxFrameSize?: number;
  maxTextures?: number;
  maxTextureSize?: number;
  maxTotalTexturePixels?: number;
  query?: string;
}

export interface IQuadInformation {
  baseUrl: string;
  restRequest: (params: any) => Promise<any>;
  restUrl: string;
  queryParameters: IQuadQuery;
}

export interface ILayerStackImage {
  layer: IDisplayLayer;
  images: IImage[];
  urls: (string | undefined)[];
  fullUrls: (string | undefined)[];
  hist: ITileHistogram | null;
  singleFrame: number | null;
  baseQuadOptions?: IQuadInformation;
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
  "#40C0FF",
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
  GFP: "#00FF00",
};

import { v4 as uuidv4 } from "uuid";
import { ISetQuadStatus } from "@/utils/setFrameQuad";
import { ITileMeta } from "./GirderAPI";
import { isEqual } from "lodash";
import {
  ManualInputNode,
  OutputNode,
  TNoOutput,
} from "@/pipelines/computePipeline";

export function newLayer(
  dataset: IDataset,
  layers: IDisplayLayer[],
): IDisplayLayer {
  const usedColors = new Set(layers.map((l) => l.color));
  const nextColor = colors.filter((c) => !usedColors.has(c));
  const usedChannels = new Set(layers.map((l) => l.channel));
  const nextChannel = dataset.channels
    .map((_, i) => i)
    .filter((c) => !usedChannels.has(c));

  const channelName =
    dataset.channelNames.get(nextChannel[0] || 0) ||
    `Channel ${nextChannel[0] || 0}`;
  let channelColor = channelColors[channelName.toUpperCase()];
  if (!channelColor || usedColors.has(channelColor)) {
    channelColor = nextColor[0] || colors[layers.length % colors.length];
  }
  let layerName = channelName;
  if (layerName === "" || layers.some((l) => l.name === layerName)) {
    layerName = `Layer ${layers.length + 1}`;
  }

  // guess a good new layer
  return {
    id: uuidv4(),
    name: layerName,
    visible: true,
    channel: nextChannel[0] || 0,
    time: {
      type: "current",
      value: null,
    },
    xy: {
      type: "current",
      value: null,
    },
    z: {
      type: "current",
      value: null,
    },
    color: channelColor,
    contrast: {
      mode: "percentile",
      blackPoint: 0,
      whitePoint: 100,
    },
    layerGroup: null,
  };
}

export function copyLayerWithoutPrivateAttributes(
  layer: IDisplayLayer,
): IDisplayLayer {
  const newLayer: IDisplayLayer = { ...layer };
  for (const key of Object.keys(newLayer)) {
    if (key.startsWith("_")) {
      delete newLayer[key as keyof IDisplayLayer];
    }
  }
  return newLayer;
}

// To get all the keys of IDatasetConfigurationBase without missing one
export function exampleConfigurationBase(): IDatasetConfigurationBase {
  return {
    compatibility: {
      xyDimensions: "multiple",
      zDimensions: "multiple",
      tDimensions: "multiple",
      channels: {},
    },
    layers: [],
    tools: [],
    snapshots: [],
    propertyIds: [],
    scales: {
      pixelSize: { value: 1, unit: "m" },
      zStep: { value: 1, unit: "m" },
      tStep: { value: 1, unit: "s" },
    },
  };
}

export function areCompatibles(
  a: IDatasetConfigurationCompatibility,
  b: IDatasetConfigurationCompatibility,
) {
  return (
    a.tDimensions === b.tDimensions &&
    a.xyDimensions === b.xyDimensions &&
    a.zDimensions === b.zDimensions &&
    isEqual(a.channels, b.channels)
  );
}

export const configurationBaseKeys = new Set(
  Object.keys(exampleConfigurationBase()),
) as Set<keyof IDatasetConfigurationBase>;

export enum AnnotationSelectionTypes {
  ADD = "ADD",
  TOGGLE = "TOGGLE",
  REMOVE = "REMOVE",
}

export const AnnotationSelectionTypesNames = {
  [AnnotationSelectionTypes.ADD]: "Add",
  [AnnotationSelectionTypes.TOGGLE]: "Toggle",
  [AnnotationSelectionTypes.REMOVE]: "Remove",
};

export const AnnotationSelectionTypesTooltips = {
  [AnnotationSelectionTypes.ADD]: "Add annotations to selection",
  [AnnotationSelectionTypes.TOGGLE]: "Toggle annotations selection",
  [AnnotationSelectionTypes.REMOVE]: "Remove annotation from selection",
};
