import { vuetifyConfig } from "@/girder";
import { merge } from "lodash";
import Vue from "vue";
import Vuetify from "vuetify/lib";
import { VuetifyPreset } from "vuetify/types/services/presets";
import Persister from "@/store/Persister";

Vue.use(Vuetify);

const custom = {
  theme: {
    dark: Persister.get("theme", "dark") === "dark",
  },
};
const config: Partial<VuetifyPreset> = merge({}, vuetifyConfig, custom);

export default new Vuetify(config);
