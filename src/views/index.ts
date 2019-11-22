import Vue from "vue";
import VueRouter from "vue-router";
import Home from "./Home.vue";
import Viewer from "./Viewer.vue";

Vue.use(VueRouter);

const routes = [
  {
    path: "/",
    name: "home",
    component: Home
  },
  {
    path: "/:id",
    name: "view",
    props: true,
    component: Viewer
  }
];

const router = new VueRouter({
  routes
});

export default router;
