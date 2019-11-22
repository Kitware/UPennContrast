import Vue from "vue";
import "reflect-metadata";
import App from "./App.vue";
import "./registerServiceWorker";
import router from "./views";
import main, { store } from "./store";
import vuetify from "./plugins/vuetify";
import "roboto-fontface/css/roboto/roboto-fontface.css";
import "@mdi/font/css/materialdesignicons.css";
import Girder from "./girder";

Vue.config.productionTip = false;

Vue.use(Girder);

new Vue({
  provide: () => ({
    girderRest: main.girderRest
  }),
  router,
  store,
  vuetify,
  render: (h: any) => h(App)
}).$mount("#app");
