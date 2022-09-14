<template>
  <v-app id="inspire">
    <v-app-bar class="elevation-1" app clipped-right>
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      <v-toolbar-title @click="goHome" class="logo"
        >NimbusImage</v-toolbar-title
      >
      <bread-crumbs />
      <v-spacer />
      <v-btn @click.stop="updateRightPanel('snapshotPanel')" id="snapshotButton"
        >Snapshot</v-btn
      >
      <user-menu />
      <v-btn @click.stop="updateRightPanel('annotationPanel')"
        >Browse Annotations</v-btn
      >
      <server-status />
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" app disable-resize-watcher>
      <Menu />
    </v-navigation-drawer>

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
import Menu from "./layout/Menu.vue";
import UserMenu from "./layout/UserMenu.vue";
import ServerStatus from "./components/ServerStatus.vue";
import Snapshots from "./components/Snapshots.vue";
import AnnotationBrowser from "@/components/AnnotationBrowser/AnnotationBrowser.vue";
import BreadCrumbs from "./layout/BreadCrumbs.vue";
import vMousetrap from "./utils/v-mousetrap";
import { Vue, Component, Prop } from "vue-property-decorator";
import toolsStore from "@/store/tool";

Vue.use(vMousetrap);

@Component({
  components: {
    AnnotationBrowser,
    Menu,
    UserMenu,
    BreadCrumbs,
    ServerStatus,
    Snapshots
  }
})
export default class App extends Vue {
  readonly toolsStore = toolsStore;
  drawer = false;
  snapshotPanel = false;
  snapshotPanelFull = false;

  annotationPanel = false;

  lastRightPanelUpdate: string | undefined;

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

  updateRightPanel(panel: string) {
    this.$data[panel] = !this.$data[panel];
    // The last panel updated has to be closed if it is not the currently updated panel
    if (
      this.lastRightPanelUpdate !== undefined &&
      this.lastRightPanelUpdate !== panel
    ) {
      this.$data[this.lastRightPanelUpdate] = false;
    }
    this.lastRightPanelUpdate = panel;
  }
}
</script>
<style lang="scss" scoped>
.logo {
  cursor: pointer;
}
#snapshotButton {
  margin-right: 1em;
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
