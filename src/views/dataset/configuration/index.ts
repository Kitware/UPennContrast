import ConfigurationInfo from "./ConfigurationInfo.vue";

export const routes = [
  {
    path: "",
    name: "cinfo",
    component: ConfigurationInfo,
    meta: {
      hidden: true
    }
  }
];

export { default } from "./Configuration.vue";
