import ConfigurationInfo from "./ConfigurationInfo.vue";
import Viewer from "./Viewer.vue";

export const routes = [
  {
    path: "",
    name: "configuration",
    component: ConfigurationInfo,
    meta: {
      hidden: true
    }
  },
  {
    path: "view",
    name: "view",
    props: true,
    component: Viewer,
    meta: {
      text: "Explore"
    }
  }
];

export { default } from "./Configuration.vue";
