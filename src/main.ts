import Vue from "vue";
import "roboto-fontface/css/roboto/roboto-fontface.css";
import "@mdi/font/css/materialdesignicons.min.css";

import "reflect-metadata";
import "./registerServiceWorker";
import vuetify from "./plugins/vuetify";
import VueAsyncComputed from "vue-async-computed";
import "./plugins/router";
import "./plugins/resize";
import { RestClientInstance } from "./girder";

import main, { store, Main } from "./store";

import routes from "./views";
import App from "./App.vue";

import "./style.scss";
import VueRouter from "vue-router";

Vue.config.productionTip = false;

Vue.use(VueAsyncComputed);

main.initialize();

new Vue({
  provide: {
    // use a proxy to dynamically resolve to the right girderRest client
    girderRest: new Proxy(main, {
      get(obj: Main, prop: keyof RestClientInstance) {
        return obj.girderRest[prop];
      }
    })
  },
  router: new VueRouter({
    routes
  }),
  store,
  vuetify,
  render: (h: any) => h(App)
}).$mount("#app");
