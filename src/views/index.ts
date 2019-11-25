import Home from "./Home.vue";
import Dataset, { routes as datasetRoutes } from "./dataset";
import { Main } from "@/store";

export default [
  {
    path: "/",
    name: "home",
    component: Home
  },
  {
    path: "/:id",
    props: true,
    component: Dataset,
    children: datasetRoutes,
    meta: {
      name(store: Main) {
        return store.dataset?.name || store.selectedDatasetId;
      }
    }
  }
];
