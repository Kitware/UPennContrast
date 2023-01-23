<template>
  <v-app id="inspire">
    <v-app-bar class="elevation-1" app clipped-right>
      <v-toolbar-title @click="goHome" class="logo"
        >NimbusImage</v-toolbar-title
      >
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
      <user-menu class="ml-4" />
      <v-btn text icon class="ml-4" @click="dark = !dark">
        <v-icon>mdi-theme-light-dark</v-icon>
      </v-btn>
      <v-divider class="ml-4" vertical />
      <template v-if="store.dataset && routeName === 'view'">
        <v-btn
          class="ml-4"
          :to="{
            name: 'newconfiguration',
            params: { id: store.selectedDatasetId }
          }"
        >
          New Configuration
        </v-btn>
        <v-btn class="ml-4" @click.stop="toggleRightPanel('snapshotPanel')"
          >Snapshots</v-btn
        >
        <v-btn class="ml-4" @click.stop="toggleRightPanel('annotationPanel')"
          >Browse Annotations</v-btn
        >
      </template>
      <server-status />
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>
    <v-navigation-drawer
      v-model="snapshotPanel"
      app
      right
      disable-resize-watcher
      clipped
      hide-overlay
      :width="320"
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
import Snapshots from "./components/Snapshots.vue";
import AnnotationBrowser from "@/components/AnnotationBrowser/AnnotationBrowser.vue";
import BreadCrumbs from "./layout/BreadCrumbs.vue";
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import toolsStore from "@/store/tool";
import Persister from "@/store/Persister";

@Component({
  components: {
    AnnotationBrowser,
    UserMenu,
    BreadCrumbs,
    ServerStatus,
    Snapshots
  }
})
export default class App extends Vue {
  readonly store = store;
  readonly toolsStore = toolsStore;
  drawer = false;
  snapshotPanel = false;
  snapshotPanelFull = false;

  annotationPanel = false;

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
        this.toolsStore.setToolTemplateList(resp.data);
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

  get routeName() {
    return this.$route.name;
  }

  @Watch("routeName")
  datasetChanged() {
    if (this.routeName !== "view") {
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
