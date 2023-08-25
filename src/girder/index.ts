export { vuetifyConfig } from "@girder/components/src/utils";
export {
  default as RestClient //,
} from "@girder/components/src/rest";
import { RestClientInstance as RCInterface } from "@girder/components/src/rest";
export interface RestClientInstance extends RCInterface {}

export interface IGirderUser {
  name: string; // TODO check
  _modelType: "user";
  _id: string;
  icon?: string;

  login: string;
}

export type IGirderLocation =
  | IGirderUser
  | IGirderFolder
  | { type: "collections" | "root" | "users" };

export interface IGirderItem {
  _modelType: "item";
  _id: string;

  name: string;
  description: string;
  folderId: string;
  meta: any;
  icon?: string;
  largeImage?: any;
}

export interface IGirderFolder {
  _modelType: "folder";
  _id: string;

  name: string;
  description: string;
  meta: any;
  icon?: string;
  parentId?: string;
}

export interface IGirderFile {
  _modelType: "file";
  _id: string;

  name: string;
  icon?: string;
}

export type IGirderSelectAble =
  | IGirderItem
  | IGirderUser
  | IGirderFolder
  | IGirderFile;
