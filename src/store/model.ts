import {
  IGirderItem,
  IGirderFolder,
  IGirderSelectAble
} from "@girder/components/src";

export interface IDimension {
  min: number;
  max: number;
}

export interface IDatasetConfigurationMeta {
  id: string;
  datasetId: string;
  datasetName: string;
  name: string;
  description: string;
}

export interface IDataset {
  readonly id: string;
  readonly _girder: IGirderFolder;

  name: string;
  description: string;

  z: IDimension;
  time: IDimension;
  channels: IDimension[];

  configurations: IDatasetConfiguration[];
}

export interface IDatasetConfiguration {
  readonly id: string;
  readonly _girder: IGirderItem;

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

export function isConfigurationItem(item: IGirderItem) {
  return item.meta.subtype === "contrastConfiguration";
}

export function isDatasetFolder(folder: IGirderFolder) {
  return folder.meta.subtype === "contrastDataset";
}
