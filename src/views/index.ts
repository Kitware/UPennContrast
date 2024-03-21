import Home from "./Home.vue";
import DefaultRouterView from "./DefaultRouterView.vue";
import datasetRoutes from "./dataset";
import configurationRoutes from "./configuration";
import datasetViewRoutes from "./datasetView";

import { RouteConfig } from "vue-router";

const routes: RouteConfig[] = [
  {
    path: "/",
    name: "root",
    component: Home,
    meta: {
      hidden: true,
    },
  },
  {
    path: "/dataset",
    children: datasetRoutes,
    component: DefaultRouterView,
  },
  {
    path: "/configuration",
    children: configurationRoutes,
    component: DefaultRouterView,
  },
  {
    path: "/datasetView",
    children: datasetViewRoutes,
    component: DefaultRouterView,
  },
  {
    path: "*",
    redirect: {
      name: "root",
    },
  },
];

export default routes;
