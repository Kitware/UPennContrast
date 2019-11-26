import DatasetInfo from "./DatasetInfo.vue";
import Configuration, { routes as cRoutes } from "./configuration";
import NewConfiguration from "./configuration/NewConfiguration.vue";
import { Main } from "@/store";

export const routes = [
  {
    path: "",
    name: "dataset",
    component: DatasetInfo,
    meta: {
      hidden: true
    }
  },
  {
    path: "new",
    name: "newconfiguration",
    component: NewConfiguration,
    meta: {
      text: "New Configuration"
    }
  },
  {
    path: ":config",
    component: Configuration,
    props: true,
    meta: {
      name: "configuration",
      text(store: Main) {
        return store.configuration?.name || store.selectedConfigurationId;
      }
    },
    children: cRoutes
  }
];

export { default } from "./Dataset.vue";
