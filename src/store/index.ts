import { RestClient, RestClientHelper } from "@/girder";
import {
  IGirderLocation,
  IGirderSelectAble,
  IGirderUser
} from "@girder/components/src";
import Vue from "vue";
import Vuex from "vuex";
import {
  Action,
  getModule,
  Module,
  Mutation,
  VuexModule
} from "vuex-module-decorators";
import {
  IDataset,
  IDisplayLayer,
  IDatasetConfiguration,
  IDatasetConfigurationMeta,
  newLayer,
  CompositionMode
} from "./model";

Vue.use(Vuex);

export const store = new Vuex.Store({});

class Persister {
  private readonly store: Storage;
  constructor(store = window.localStorage) {
    this.store = store;
  }
  get<T>(key: string, defaultValue: T): T {
    const r = this.store.getItem(key);
    return r === null ? defaultValue : (JSON.parse(r) as T);
  }
  set<T>(key: string, value: T): T {
    this.store.setItem(key, JSON.stringify(value));
    return value;
  }
  delete(key: string) {
    const r = this.store.getItem(key);
    this.store.removeItem(key);
    return r != null;
  }
}

const persister = new Persister();

@Module({ dynamic: true, store, name: "main" })
export class Main extends VuexModule {
  girderUrl = persister.get("girderUrl", "http://localhost:8080");
  girderRest = new RestClient({
    apiRoot: `${this.girderUrl}/api/v1`
  });

  girderUser: IGirderUser | null = this.girderRest.user;

  selectedDatasetId: string | null = null;
  dataset: IDataset | null = null;

  selectedConfigurationId: string | null = null;
  configuration: IDatasetConfiguration | null = null;
  recentConfigurations: IDatasetConfigurationMeta[] = persister.get(
    "recentConfigurations",
    []
  );

  z: number = 0;
  time: number = 0;
  compositionMode: CompositionMode = "multiply";

  private internalLocation: IGirderLocation | null = null;

  get api() {
    return new RestClientHelper(this.girderRest);
  }

  get location(): IGirderLocation {
    if (this.internalLocation) {
      return this.internalLocation;
    }
    if (this.isLoggedIn && this.girderUser) {
      return this.girderUser;
    }
    return { type: "root" };
  }

  get userName() {
    return this.girderUser ? this.girderUser.login : "anonymous";
  }

  get isLoggedIn() {
    return this.girderUser != null;
  }

  @Mutation
  changeLocation(location: IGirderLocation | null) {
    this.internalLocation = location;
  }

  @Mutation
  protected loggedIn({
    girderUrl,
    girderRest
  }: {
    girderUrl: string;
    girderRest: RestClient;
  }) {
    this.girderUrl = persister.set("girderUrl", girderUrl);
    this.girderRest = girderRest;
    this.girderUser = girderRest.user;
  }

  @Mutation
  protected loggedOut() {
    this.girderUser = null;
    this.selectedDatasetId = null;
    this.dataset = null;
    this.selectedConfigurationId = null;
    this.configuration = null;
    this.internalLocation = null;
  }

  @Mutation
  protected setDataset({
    id,
    data
  }: {
    id: string | null;
    data: IDataset | null;
  }) {
    this.selectedDatasetId = id;
    this.dataset = data;
  }
  @Mutation
  protected setConfiguration({
    id,
    data
  }: {
    id: string | null;
    data: IDatasetConfiguration | null;
  }) {
    this.selectedConfigurationId = id;
    this.configuration = data;
    if (data) {
      // remove old
      const index = this.recentConfigurations.findIndex(d => d.id === data.id);
      if (index >= 0) {
        this.recentConfigurations.splice(index, 1);
      }
      this.recentConfigurations.unshift({
        id: data.id,
        name: data.name,
        description: data.description,
        datasetId: this.selectedDatasetId!,
        datasetName: this.dataset?.name || "Unknown"
      });
      persister.set("recentConfigurations", this.recentConfigurations);
    }
  }

  @Mutation
  private setZImpl(value: number) {
    this.z = value;
  }

  @Mutation
  private setTimeImpl(value: number) {
    this.time = value;
  }

  @Action({})
  async logout() {
    try {
      await this.girderRest.logout();
    } catch {
      // ignore
      // console.log("error during logging out", err);
    }
    this.loggedOut();
  }

  @Action
  async initialize() {
    if (!this.girderRest.token) {
      return;
    }
    try {
      const user = await this.girderRest.fetchUser();
      if (user) {
        this.loggedIn({
          girderUrl: this.girderUrl,
          girderRest: this.girderRest
        });
      }
      await this.initFromUrl();
    } catch (error) {
      // TODO
    }
  }

  @Action
  private async initFromUrl() {
    if (this.girderUser && this.selectedDatasetId) {
      // load after logged in
      await this.setSelectedDataset(this.selectedDatasetId);
    }
    if (this.girderUser && this.selectedConfigurationId && this.dataset) {
      // load after logged in
      await this.setSelectedConfiguration(this.selectedConfigurationId);
    }
  }

  @Action
  async login({
    domain,
    username,
    password
  }: {
    domain: string;
    username: string;
    password: string;
  }) {
    const restClient = new RestClient({
      apiRoot: `${domain}/api/v1`
    });

    try {
      await restClient.login(username, password);
    } catch (err) {
      if (!err.response || err.response.status !== 401) {
        return "Unknown error occurred";
      } else {
        const { message } = err.response.data;
        return message || "Unauthorized.";
      }
    }

    this.loggedIn({
      girderUrl: domain,
      girderRest: restClient
    });

    await this.initFromUrl();
    return null;
  }

  @Action
  async setSelectedDataset(id: string | null) {
    if (!this.isLoggedIn || !id) {
      this.setDataset({ id, data: null });
      return;
    }
    try {
      const r = await this.api.getDataset(id);
      this.setDataset({ id, data: r });
    } catch (error) {
      // TODO
    }
  }

  @Action
  async setSelectedConfiguration(id: string | null) {
    if (!this.isLoggedIn || !id) {
      this.setConfiguration({ id, data: null });
      return;
    }
    try {
      const r = await this.api.getDatasetConfiguration(id);
      this.setConfiguration({ id, data: r });
    } catch (error) {
      // TODO
    }
  }

  @Action
  async createDataset({
    name,
    description,
    path
  }: {
    name: string;
    description: string;
    path: IGirderSelectAble;
  }) {
    try {
      const ds = await this.api.createDataset(name, description, path);
      return ds;
    } catch (error) {
      // TODO
    }
    return null;
  }

  @Action
  async createConfiguration({
    name,
    description
  }: {
    name: string;
    description: string;
  }) {
    try {
      const config = await this.api.createConfiguration(
        name,
        description,
        this.dataset!
      );
      return config;
    } catch (error) {
      // TODO
    }
    return null;
  }

  @Action
  async setZ(value: number) {
    this.setZImpl(value);
  }

  @Action
  async setTime(value: number) {
    this.setTimeImpl(value);
  }

  @Mutation
  private pushLayer(layer: IDisplayLayer) {
    this.configuration!.layers.push(layer);
  }

  @Mutation
  private toggleLayer(index: number) {
    if (!this.configuration) {
      return;
    }
    const layers = this.configuration.layers;
    switch (this.configuration.layerMode) {
      case "single":
        layers.forEach((l, i) => (l.visible = i === index));
        break;
      case "multiple":
        layers[index].visible = !layers[index].visible;
        break;
    }
  }

  @Action
  async addLayer() {
    if (!this.configuration || !this.dataset) {
      return;
    }
    this.pushLayer(newLayer(this.dataset, this.configuration));
  }

  @Mutation
  private setCompositionModeImpl(mode: CompositionMode) {
    this.compositionMode = mode;
  }

  @Action
  async setCompositionMode(mode: CompositionMode) {
    this.setCompositionModeImpl(mode);
  }

  @Action
  handleHotkey(hotKey: number) {
    if (
      !this.dataset ||
      !this.configuration ||
      hotKey < 1 ||
      hotKey > this.configuration.layers.length
    ) {
      return;
    }
    this.toggleLayer(hotKey - 1);
  }

  @Mutation
  changeLayer({
    index,
    delta
  }: {
    index: number;
    delta: Partial<IDisplayLayer>;
  }) {
    if (
      !this.configuration ||
      index < 0 ||
      index >= this.configuration.layers.length
    ) {
      return;
    }
    Object.assign(this.configuration.layers[index], delta);
  }

  @Mutation
  removeLayer(index: number) {
    if (
      !this.configuration ||
      index < 0 ||
      index >= this.configuration.layers.length
    ) {
      return;
    }
    this.configuration.layers.splice(index, 1);
  }
}

const main = getModule(Main);

main.initialize();

export default main;
