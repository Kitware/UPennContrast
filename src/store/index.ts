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
import { IGirderUser } from "@girder/components/src";

Vue.use(Vuex);

export const store = new Vuex.Store({});

@Module({ dynamic: true, store, name: "main" })
export class Main extends VuexModule {
  girderUrl =
    window.localStorage.getItem("girderUrl") || "http://localhost:8080";
  girderRest = new RestClient({
    apiRoot: `${this.girderUrl}/api/v1`
  });

  girderUser: IGirderUser | null = this.girderRest.user;

  get userName() {
    return this.girderUser ? this.girderUser.login : "anonymous";
  }

  get isLoggedIn() {
    return this.girderUser != null;
  }

  @Mutation
  protected loggedIn({
    girderUrl,
    girderRest
  }: {
    girderUrl: string;
    girderRest: RestClient;
  }) {
    this.girderUrl = girderUrl;
    // store for next time
    window.localStorage.setItem("girderUrl", girderUrl);
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
