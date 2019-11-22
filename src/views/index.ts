import VueRouter from "vue-router";
import Home from "./Home.vue";
import Info from "./viewer/Info.vue";
import Viewer from "./viewer/Viewer.vue";

const routes = [
  {
    path: "/",
    name: "home",
    component: Home
  },
  {
    path: "/:id",
    props: true,
    component: Viewer,
    children: [
      {
        path: "",
        name: "view",
        component: Info
      }
    ]
  }
];

const router = new VueRouter({
  routes
});

export default router;
