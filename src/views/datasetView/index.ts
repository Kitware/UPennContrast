import DatasetView from "./DatasetView.vue";
import Viewer from "./Viewer.vue";
import { RouteConfig } from "vue-router";

const routes: RouteConfig[] = [
  {
    path: ":datasetViewId",
    component: DatasetView,
    children: [
      {
        path: "view",
        name: "datasetview",
        component: Viewer,
        meta: {
          text: "Explore"
        }
      }
    ]
  }
];

export default routes;
