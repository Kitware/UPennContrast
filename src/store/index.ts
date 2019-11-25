import Vue from "vue";
import Vuex from "vuex";
import {
  Module,
  VuexModule,
  Mutation,
  Action,
  getModule
} from "vuex-module-decorators";
import { RestClient, RestClientHelper } from "@/girder";
import {
  IGirderUser,
  IGirderLocation,
  IGirderItem
} from "@girder/components/src";
import { IDataset, IDatasetConfiguration } from "./model";

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
    return { type: "collection" };
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
  protected setDataset({ id, data }: { id: string; data: IDataset }) {
    this.selectedDatasetId = id;
    this.dataset = data;
  }
  @Mutation
  protected setConfiguration({
    id,
    data
  }: {
    id: string;
    data: IDatasetConfiguration;
  }) {
    this.selectedConfigurationId = id;
    this.configuration = data;
  }

  @Action({})
  async logout() {
    try {
      await this.girderRest.logout();
    } catch {
      // ignore
      // console.log("error during logging out", err);
    }
    this.context.commit("loggedOut");
  }

  @Action
  async initialize() {
    if (!this.girderRest.token) {
      return;
    }
    try {
      const user = await this.girderRest.fetchUser();
      if (user) {
        this.context.commit("loggedIn", {
          girderUrl: this.girderUrl,
          girderRest: this.girderRest
        });
      }
      await this.initFromUrl();
    } catch (error) {
      // TODO
    }
  }

  private async initFromUrl() {
    if (this.girderUser && this.selectedDatasetId) {
      // load after logged in
      await this.context.dispatch("setDataset", this.selectedDatasetId);
    }
    if (this.girderUser && this.selectedConfigurationId && this.dataset) {
      // load after logged in
      await this.context.dispatch(
        "setConfiguration",
        this.selectedConfigurationId
      );
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

    this.context.commit("loggedIn", {
      girderUrl: domain,
      girderRest: restClient
    });

    await this.initFromUrl();
    return null;
  }

  @Action
  async setSelectedDataset(id: string | null) {
    if (!this.isLoggedIn || !id) {
      this.context.commit("setDataset", { id });
      return;
    }
    try {
      const r = await this.api.getDataset(id);
      this.context.commit("setDataset", { id, data: r });
    } catch (error) {
      // TODO
    }
  }

  @Action
  async setSelectedConfiguration(id: string | null) {
    if (!this.isLoggedIn || !id) {
      this.context.commit("setConfiguration", { id });
      return;
    }
    try {
      const r = await this.api.getDatasetConfiguration(id);
      this.context.commit("setConfiguration", { id, data: r });
    } catch (error) {
      // TODO
    }
  }
}

const main = getModule(Main);

main.initialize();

export default main;
