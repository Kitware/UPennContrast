import Vue from "vue";
import "reflect-metadata";
import "./registerServiceWorker";
import vuetify from "./plugins/vuetify";
import "./plugins/router";
import Girder, { RestClient } from "./girder";

import main, { store, Main } from "./store";

import router from "./views";
import App from "./App.vue";

import "roboto-fontface/css/roboto/roboto-fontface.css";
import "@mdi/font/css/materialdesignicons.css";

Vue.config.productionTip = false;

Vue.use(Girder);

new Vue({
  provide: {
    // use a proxy to dynamically resolve to the right girderRest client
    girderRest: new Proxy(main, {
      get(obj: Main, prop: keyof RestClient) {
        return obj.girderRest[prop];
      }
    })
  },
  router,
  store,
  vuetify,
  render: (h: any) => h(App)
}).$mount("#app");
