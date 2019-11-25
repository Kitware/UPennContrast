import DatasetInfo from "./DatasetInfo.vue";
import Configuration, { routes as cRoutes } from "./configuration";

export const routes = [
  {
    path: "",
    name: "info",
    component: DatasetInfo,
    meta: {
      hidden: true
    }
  },
  {
    path: ":config",
    component: Configuration,
    props: true,
    meta: {
      hidden: true
    },
    children: cRoutes
  }
];

export { default } from "./Dataset.vue";
