export interface IDimension {
  min: number;
  max: number;
}

export interface IDataset {
  id: string;
  name: string;
  description: string;

  z: IDimension;
  time: IDimension;
  channels: IDimension[];

  configurations: IDatasetConfiguration[];
}

export interface IDatasetConfiguration {
  id: string;
  name: string;
  description: string;

  layers: IDisplayLayer[];
  // whether to show multiple ... hotkey/toggle as checkbox
  // single ... hotkey/toggle as radio
  layerMode: "multiple" | "single";
}

export interface IDisplaySlice {
  type: "current" | "max-merge" | "constant" | "offset";
  value: number | null;
}

// UI TODO: hotkey for enable/disable layer: 1 ... toggle layer 1

export interface IDisplayLayer {
  name: string;
  color: string;

  // TODO: boolean or which channel to use? why multiple allowed and how to combine
  fluorescenceChannel: boolean;

  z: IDisplaySlice;
  time: IDisplaySlice;

  visible: boolean;

  contrast: IContrast;
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
