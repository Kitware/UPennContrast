declare module "@girder/components/src/components" {
  import Vue, { VueConstructor, Component } from "vue";

  export const Upload: Component;
}

declare module "@girder/components/src/components/Snippet" {
  import Vue, { VueConstructor, Component } from "vue";

  export const FileManager: Component;
}

declare module "@girder/components/src/utils" {
  export const vuetifyConfig: any;
}

declare module "@girder/components/src" {
  import { PluginObject } from "vue";
  import { AxiosInstance } from "axios";

  const Girder: PluginObject<any>;

  export default Girder;

  export interface IGirderUser {
    _modelType: "user";
    _id: string;

    login: string;
    type: "user";
  }

  export interface IGirderLocation {
    type: "collection" | "user" | "folder";
  }

  export interface IGirderItem {
    _modelType: "item";
    _id: string;

    name: string;
    description: string;
    meta: any;
  }

  export interface IGirderFolder {
    _modelType: "folder";
    _id: string;

    name: string;
    description: string;
    meta: any;
  }

  export interface IGirderFile {
    _modelType: "file";
    _id: string;

    name: string;
  }

  export type IGirderSelectAble =
    | IGirderItem
    | IGirderUser
    | IGirderFolder
    | IGirderFile;

  interface IRestClientOptions {
    apiRoot: string;
    token: string;
    useGirderAuthorizationHeader: boolean;
    setLocalCookie: true;
  }
  export interface RestClient
    extends AxiosInstance,
      Readonly<IRestClientOptions> {
    readonly user: Readonly<IGirderUser> | null;

    login(username: string, password: string, otp?: string): Promise<any>;
    logout(): void | Promise<void>;
    register(
      login: string,
      email: string,
      firstName: string,
      lastName: string,
      password: string,
      admin?: boolean
    ): Promise<any>;

    fetchUser(): Promise<Readonly<IGirderUser>>;
  }

  export interface RestClientConstructor {
    new (options: Partial<IRestClientOptions>): RestClient;
  }

  export const RestClient: RestClientConstructor;
}
