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
import { IGirderUser, IGirderLocation } from "@girder/components/src";

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

  internalLocation: IGirderLocation | null = null;

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

  @Action({})
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
    return null;
  }
}

const main = getModule(Main);

export default main;
