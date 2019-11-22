import { vuetifyConfig } from "@/girder";
import { merge } from "lodash-es";
import Vue from "vue";
import Vuetify from "vuetify/lib";
import { VuetifyPreset } from "vuetify/types/presets";

Vue.use(Vuetify);

const custom: Partial<VuetifyPreset> = {
  theme: {
    dark: false
  },
  icons: {
    values: {
      domain: "mdi-domain"
    }
  }
};
const config: Partial<VuetifyPreset> = merge({}, vuetifyConfig, custom);

export default new Vuetify(config);
