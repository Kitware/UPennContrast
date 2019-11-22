import Vue from "vue";
import Vuex from "vuex";
import {
  Module,
  VuexModule,
  Mutation,
  Action,
  getModule
} from "vuex-module-decorators";
import { RestClient } from "@/girder";
import {
  IGirderUser,
  IGirderLocation,
  IGirderItem
} from "@girder/components/src";

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

  selectedItemId: string | null = null;
  selectedItem: IGirderItem | null = null;
  private internalLocation: IGirderLocation | null = null;

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
  }

  @Mutation
  protected setItem({ itemId, data }: { itemId: string; data: any }) {
    this.selectedItemId = itemId;
    this.selectedItem = data;
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
      if (user && this.selectedItemId) {
        // load after logged in
        await this.context.dispatch("setSelectedItem", this.selectedItemId);
      }
    } catch (error) {
      // TODO
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

    if (this.selectedItemId) {
      // load after logged in
      await this.context.dispatch("setSelectedItem", this.selectedItemId);
    }
    return null;
  }

  @Action
  async setSelectedItem(itemId: string) {
    if (!this.isLoggedIn) {
      this.context.commit("setItem", { itemId });
      return;
    }
    try {
      const r = await this.girderRest.get(`item/${itemId}`);
      console.log(r);
      this.context.commit("setItem", { itemId, data: r.data });
    } catch (error) {
      // TODO
    }
  }
}

const main = getModule(Main);

main.initialize();

export default main;
