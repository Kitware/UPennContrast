import Home from "./Home.vue";
import Dataset, { routes as datasetRoutes } from "./dataset";

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
    children: datasetRoutes
  }
];
