import Home from "./Home.vue";
import Dataset, { routes as datasetRoutes } from "./dataset";
import NewDataset from "./dataset/NewDataset.vue";
import { Main } from "@/store";

export default [
  {
    path: "/",
    name: "home",
    component: Home
  },
  {
    path: "/new",
    name: "newdataset",
    component: NewDataset,
    meta: {
      text: "New Dataset"
    }
  },
  {
    path: "/:id",
    props: true,
    component: Dataset,
    children: datasetRoutes,
    meta: {
      text(store: Main) {
        return store.dataset?.name || store.selectedDatasetId;
      }
    }
  }
];
