import Vue from "vue";
import Vuex from "vuex";
import {
  Module,
  VuexModule,
  Mutation,
  Action,
  getModule
} from "vuex-module-decorators";

Vue.use(Vuex);

export const store = new Vuex.Store({});

@Module({ dynamic: true, store, name: "main" })
export class Main extends VuexModule {
  count = 0;

  @Mutation
  increment(delta: number) {
    this.count += delta;
  }
  @Mutation
  decrement(delta: number) {
    this.count -= delta;
  }

  // action 'incr' commits mutation 'increment' when done with return value as payload
  @Action({ commit: "increment" })
  incr() {
    return 5;
  }
  // action 'decr' commits mutation 'decrement' when done with return value as payload
  @Action({ commit: "decrement" })
  decr() {
    return 5;
  }
}

const main = getModule(Main);

export default main;
