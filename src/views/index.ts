import Home from "./Home.vue";
import viewerRoutes from "./viewer";
import Viewer from "./viewer/Viewer.vue";

export default [
  {
    path: "/",
    name: "home",
    component: Home
  },
  {
    path: "/:id",
    props: true,
    component: Viewer,
    children: viewerRoutes
  }
];
