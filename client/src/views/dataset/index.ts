import Dataset from "./Dataset.vue";
import NewDataset from "./NewDataset.vue";
import ImportDataset from "./ImportDataset.vue";
import DatasetInfo from "./DatasetInfo.vue";
import configurationRoutes from "./configuration";
import { Main } from "@/store";
import { RouteConfig } from "vue-router";

const routes: RouteConfig[] = [
  {
    path: "/new",
    name: "newdataset",
    component: NewDataset,
    meta: {
      text: "Upload New Data"
    }
  },
  {
    path: "/import",
    name: "importdataset",
    component: ImportDataset,
    meta: {
      text: "Use Existing Data"
    }
  },
  {
    path: "/:id",
    props: true,
    component: Dataset,
    children: [
      {
        path: "",
        name: "dataset",
        component: DatasetInfo,
        meta: {
          hidden: true
        }
      },
      ...configurationRoutes
    ],
    meta: {
      name: "dataset",
      text(store: Main) {
        return store.dataset?.name || store.selectedDatasetId;
      }
    }
  }
];

export default routes;
