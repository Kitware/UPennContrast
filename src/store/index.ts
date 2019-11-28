import { RestClient } from "@/girder";
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
  CompositionMode,
  IImageTile
} from "./model";
import { getLayerImages } from "./images";
import GirderAPI from "./GirderAPI";
import persister from "./Persister";

Vue.use(Vuex);

export const store = new Vuex.Store({});

@Module({ dynamic: true, store, name: "main" })
export class Main extends VuexModule {
  girderUrl = persister.get("girderUrl", "http://localhost:8080");
  girderRest = new RestClient({
    apiRoot: `${this.girderUrl}/api/v1`
  });
  api = new GirderAPI(this.girderRest);
  girderUser: IGirderUser | null = this.girderRest.user;

  loading = false;
  saving = false;
  lastError: Error | null = null;

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
  layerMode: "single" | "multiple" = "multiple";

  private internalLocation: IGirderLocation | null = null;

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
  private setSaving(status: boolean | Error) {
    this.saving = status === true;
    if (typeof status !== "boolean") {
      this.lastError = status;
    }
  }

  @Mutation
  private setLoading(status: boolean | Error) {
    this.loading = status === true;
    if (typeof status !== "boolean") {
      this.lastError = status;
    }
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
    this.api = new GirderAPI(this.girderRest);
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
    if (!data) {
      return;
    }
    // persist list

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
    this.setSaving(true);
    try {
      await this.girderRest.logout();
      this.setSaving(false);
    } catch (error) {
      this.setSaving(error);
    }
    this.loggedOut();
  }

  @Action
  async initialize() {
    if (!this.girderRest.token) {
      return;
    }
    try {
      this.setLoading(true);
      const user = await this.girderRest.fetchUser();
      if (user) {
        this.loggedIn({
          girderUrl: this.girderUrl,
          girderRest: this.girderRest
        });
      }
      await this.initFromUrl();
      this.setLoading(false);
    } catch (error) {
      this.setLoading(error);
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
      this.setLoading(true);
      await restClient.login(username, password);
      this.setLoading(false);
    } catch (err) {
      this.setLoading(err);
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
    this.api.flushCaches();
    if (!this.isLoggedIn || !id) {
      this.setDataset({ id, data: null });
      return;
    }
    try {
      this.setLoading(true);
      const r = await this.api.getDataset(id);
      this.setDataset({ id, data: r });
      this.setLoading(false);
    } catch (error) {
      this.setLoading(error);
    }
  }

  @Action
  async setSelectedConfiguration(id: string | null) {
    if (!this.isLoggedIn || !id) {
      this.setConfiguration({ id, data: null });
      return;
    }
    try {
      this.setLoading(true);
      const r = await this.api.getDatasetConfiguration(id);
      this.setConfiguration({ id, data: r });
      this.setLoading(false);
    } catch (error) {
      this.setLoading(error);
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
      this.setSaving(true);
      const ds = await this.api.createDataset(name, description, path);
      this.setSaving(false);
      return ds;
    } catch (error) {
      this.setSaving(error);
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
      this.setSaving(true);
      const config = await this.api.createConfiguration(
        name,
        description,
        this.dataset!
      );
      this.setSaving(false);
      return config;
    } catch (error) {
      this.setSaving(error);
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
    switch (this.layerMode) {
      case "single":
        layers.forEach((l, i) => (l.visible = i === index));
        break;
      case "multiple":
        layers[index].visible = !layers[index].visible;
        break;
    }
  }

  @Action
  async syncConfiguration() {
    if (!this.configuration) {
      return;
    }
    this.setSaving(true);
    try {
      await this.api.updateConfiguration(this.configuration);
      this.setSaving(false);
    } catch (error) {
      this.setSaving(error);
    }
  }

  @Action
  async addLayer() {
    if (!this.configuration || !this.dataset) {
      return;
    }
    this.pushLayer(newLayer(this.dataset, this.configuration));
    await this.syncConfiguration();
  }

  @Mutation
  private setCompositionModeImpl(mode: CompositionMode) {
    this.compositionMode = mode;
  }

  @Action
  async setCompositionMode(mode: CompositionMode) {
    this.setCompositionModeImpl(mode);
  }

  @Mutation
  private setLayerModeImpl(mode: "multiple" | "single") {
    this.layerMode = mode;
  }

  @Mutation
  private verifySingleLayerMode() {
    if (!this.configuration) {
      return;
    }
    const visible = this.configuration.layers.reduce(
      (acc, l) => acc + (l.visible ? 1 : 0),
      0
    );
    if (visible > 1) {
      let first = true;
      this.configuration.layers.forEach(l => {
        if (l.visible) {
          l.visible = first;
          first = false;
        }
      });
    }
  }

  @Action
  async setLayerMode(mode: "multiple" | "single") {
    this.setLayerModeImpl(mode);

    if (mode === "single") {
      this.verifySingleLayerMode();
      await this.syncConfiguration();
    }
  }

  @Action
  async handleHotkey(hotKey: number) {
    if (
      !this.dataset ||
      !this.configuration ||
      hotKey < 1 ||
      hotKey > this.configuration.layers.length
    ) {
      return;
    }
    this.toggleLayer(hotKey - 1);
    await this.syncConfiguration();
  }

  @Mutation
  private changeLayerImpl({
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

  @Action
  async changeLayer(args: { index: number; delta: Partial<IDisplayLayer> }) {
    this.changeLayerImpl(args);
    await this.syncConfiguration();
  }

  @Mutation
  private removeLayerImpl(index: number) {
    if (
      !this.configuration ||
      index < 0 ||
      index >= this.configuration.layers.length
    ) {
      return;
    }
    this.configuration.layers.splice(index, 1);
  }

  @Action
  async removeLayer(index: number) {
    this.removeLayerImpl(index);
    await this.syncConfiguration();
  }

  get imageStack(): IImageTile[][] {
    if (!this.dataset || !this.configuration) {
      return [];
    }
    const ds = this.dataset;
    const layers = this.configuration.layers;

    return layers
      .filter(d => d.visible)
      .map(layer => {
        const images = getLayerImages(layer, ds, this.time, this.z);
        return this.api.generateImages(images, layer.color, layer.contrast);
      });
  }

  get getLayerHistogram() {
    // need to be like that to be detected as a getter
    return (layer: IDisplayLayer) => {
      if (!this.dataset || !this.configuration) {
        return Promise.resolve(null);
      }
      const images = getLayerImages(layer, this.dataset, this.time, this.z);
      return this.api.getLayerHistogram(images);
    };
  }
}

const main = getModule(Main);

main.initialize();

export default main;
