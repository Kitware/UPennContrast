import ConfigurationInfo from "./ConfigurationInfo.vue";

export const routes = [
  {
    path: "",
    name: "configuration",
    component: ConfigurationInfo,
    meta: {
      hidden: true
    }
  }
];

export { default } from "./Configuration.vue";
