import Home from "./Home.vue";
import datasetRoutes from "./dataset";

import { RouteConfig } from "vue-router";

const routes: RouteConfig[] = [
  {
    path: "/",
    name: "root",
    component: Home,
    meta: {
      hidden: true
    }
  },
  ...datasetRoutes,
  {
    path: "*",
    redirect: {
      name: "root"
    }
  }
];

export default routes;
