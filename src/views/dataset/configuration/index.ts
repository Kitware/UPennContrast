import Configuration from "./Configuration.vue";
import ConfigurationInfo from "./ConfigurationInfo.vue";
import ImportConfiguration from "./ImportConfiguration.vue";
import NewConfiguration from "./NewConfiguration.vue";
import Viewer from "./Viewer.vue";
import { Main } from "@/store";
import { RouteConfig } from "vue-router";

const routes: RouteConfig[] = [
  {
    path: "new",
    name: "newconfiguration",
    component: NewConfiguration,
    meta: {
      text: "New Configuration"
    }
  },
  {
    path: "import",
    name: "importconfiguration",
    component: ImportConfiguration,
    meta: {
      text: "Import an existing configuration"
    }
  },
  {
    path: ":config",
    component: Configuration,
    props: true,
    meta: {
      name: "configuration",
      text(store: Main) {
        return store.configuration?.name || store.selectedConfigurationId;
      }
    },
    children: [
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
    ]
  }
];

export default routes;
