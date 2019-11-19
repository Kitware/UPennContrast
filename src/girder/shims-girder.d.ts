declare module "@girder/components/src/components" {
  import Vue from "vue";

  export class Authentication extends Vue {}
}

declare module "@girder/components/src/utils" {
  export const vuetifyConfig: any;
}

declare module "@girder/components/src" {
  import { PluginObject } from "vue";

  const Girder: PluginObject<any>;

  export default Girder;

  export interface IGirderUser {
    login: string;
  }

  export class RestClient {
    constructor(options: { apiRoot: string });

    user: IGirderUser | null;
    token: string;
  }
}
