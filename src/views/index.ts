import Vue from "vue";
import VueRouter from "vue-router";
import Home from "./Home.vue";
import Upload from "./Upload.vue";

Vue.use(VueRouter);

const routes = [
  {
    path: "/",
    name: "home",
    component: Home
  },
  {
    path: "/upload",
    name: "upload",
    component: Upload
  }
];

const router = new VueRouter({
  routes
});

export default router;
