<template>
  <v-app id="inspire">
    <v-app-bar class="elevation-1" app clipped-right>
      <v-toolbar-title @click="goHome" class="logo">
        <img src="/img/icons/NimbusImageIcon.png" alt="Icon" class="logo-icon" />
      </v-toolbar-title>
      <bread-crumbs />
      <v-spacer />
      <v-btn
        color="primary"
        class="ml-4"
        :to="{ name: 'newdataset' }"
        :disabled="!store.isLoggedIn"
      >
        Upload Data
      </v-btn>
      <v-divider class="ml-4" vertical />
      <template v-if="store.dataset && routeName === 'datasetview'">
        <v-btn class="ml-4" @click.stop="toggleRightPanel('analyzePanel')">
          <v-badge dot color="red" :value="hasUncomputedProperties">
            Measure objects
          </v-badge>
        </v-btn>
        <v-btn
          class="ml-4"
          @click.stop="
            toggleRightPanel('annotationPanel');
            annotationPanelBadge = false;
          "
        >
          <v-badge dot color="green" :value="annotationPanelBadge">
            Object list
          </v-badge>
        </v-btn>
        <v-divider class="ml-4" vertical />
        <v-btn class="ml-4" @click.stop="toggleRightPanel('snapshotPanel')">
          Snapshots
        </v-btn>
        <v-btn class="ml-4" @click.stop="toggleRightPanel('settingsPanel')">
          Settings
        </v-btn>
        <user-menu class="ml-4" />
      </template>
      <server-status />
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>

    <v-navigation-drawer
      v-model="analyzePanel"
      app
      right
      disable-resize-watcher
      clipped
      hide-overlay
      :width="480"
    >
      <analyze-annotations />
    </v-navigation-drawer>

    <v-navigation-drawer
      v-model="settingsPanel"
      app
      right
      disable-resize-watcher
      clipped
      hide-overlay
      :width="480"
    >
      <annotations-settings />
    </v-navigation-drawer>

    <v-navigation-drawer
      v-model="snapshotPanel"
      app
      right
      disable-resize-watcher
      clipped
      hide-overlay
      :width="480"
      @transitionend="snapshotPanelFull = snapshotPanel"
    >
      <snapshots :snapshotVisible="snapshotPanel && snapshotPanelFull" />
    </v-navigation-drawer>

    <v-navigation-drawer
      v-model="annotationPanel"
      app
      right
      disable-resize-watcher
      clipped
      hide-overlay
      :width="640"
    >
      <annotation-browser></annotation-browser>
    </v-navigation-drawer>
  </v-app>
</template>

<script lang="ts">
import axios from "axios";
import UserMenu from "./layout/UserMenu.vue";
import ServerStatus from "./components/ServerStatus.vue";
import AnalyzeAnnotations from "./components/AnalyzePanel.vue";
import AnnotationsSettings from "./components/SettingsPanel.vue";
import Snapshots from "./components/Snapshots.vue";
import AnnotationBrowser from "@/components/AnnotationBrowser/AnnotationBrowser.vue";
import BreadCrumbs from "./layout/BreadCrumbs.vue";
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import Persister from "@/store/Persister";
import propertyStore from "@/store/properties";

@Component({
  components: {
    AnnotationBrowser,
    UserMenu,
    BreadCrumbs,
    ServerStatus,
    AnalyzeAnnotations,
    AnnotationsSettings,
    Snapshots
  }
})
export default class App extends Vue {
  readonly store = store;
  readonly propertyStore = propertyStore;

  snapshotPanel = false;
  snapshotPanelFull = false;

  annotationPanel = false;

  settingsPanel = false;

  analyzePanel = false;

  lastModifiedRightPanel: string | null = null;

  fetchConfig() {
    // Fetch the list of available tool templates
    // It consists of a json file containing a list of items, each item describing
    // the interface elements for a different tool type:
    // * name: Name of the tool type
    // * type: Type of tool to be added
    // * interface: List of various form components necessary to configure the tool
    // Interface elements have a name, an id, a type (see ToolConfiguration) and a type-dependent meta field
    axios
      .get("config/templates.json")
      .then(resp => {
        this.store.setToolTemplateList(resp.data);
      })
      .catch(err => {
        console.log(err); // eslint-disable-line no-console
        throw err;
      });
  }

  mounted() {
    this.fetchConfig();
  }

  goHome() {
    this.$router.push({ name: "root" });
  }

  toggleRightPanel(panel: string | null) {
    if (panel !== null) {
      this.$data[panel] = !this.$data[panel];
    }
    // The last panel updated has to be closed if it is not the currently updated panel
    if (
      this.lastModifiedRightPanel !== null &&
      this.lastModifiedRightPanel !== panel
    ) {
      this.$data[this.lastModifiedRightPanel] = false;
    }
    this.lastModifiedRightPanel = panel;
  }

  @Watch("annotationPanel")
  annotationPanelChanged() {
    this.store.setIsAnnotationPanelOpen(this.annotationPanel);
  }

  get annotationPanelBadge() {
    return this.store.annotationPanelBadge;
  }

  set annotationPanelBadge(value) {
    this.store.setAnnotationPanelBadge(value);
  }

  get routeName() {
    return this.$route.name;
  }

  get hasUncomputedProperties() {
    const uncomputed = this.propertyStore.uncomputedAnnotationsPerProperty;
    for (const id in uncomputed) {
      if (uncomputed[id].length > 0) {
        return true;
      }
    }
    return false;
  }

  @Watch("routeName")
  datasetChanged() {
    if (this.routeName !== "datasetview") {
      this.toggleRightPanel(null);
    }
  }

  get dark() {
    return this.$vuetify.theme.dark;
  }

  set dark(value: boolean) {
    Persister.set("theme", value ? "dark" : "light");
    this.$vuetify.theme.dark = value;
  }
}
</script>
<style lang="scss" scoped>
.logo {
  cursor: pointer;
  text-overflow: unset;
  overflow: unset;
}
</style>
<style lang="scss">
body > div {
  overflow: hidden;
}

.v-navigation-drawer {
  z-index: 100;
}
</style>
<style lang="scss" scoped>
.logo-icon {
  height: 50px; // Adjust as needed
  width: 50px; // Adjust as needed
  margin-top: 10px;
}
</style>
