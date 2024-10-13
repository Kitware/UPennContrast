<template>
  <v-app id="inspire" v-mousetrap="appHotkeys">
    <v-dialog v-model="helpPanelIsOpen" width="inherit">
      <help-panel />
    </v-dialog>
    <v-app-bar class="elevation-1" app clipped-right>
      <v-tooltip bottom open-delay="500">
        <template v-slot:activator="{ on, attrs }">
          <v-toolbar-title @click="goHome" class="logo" v-bind="attrs" v-on="on">
            <img
              src="/img/icons/NimbusImageIcon.png"
              alt="Icon"
              class="logo-icon"
            />
          </v-toolbar-title>
        </template>
        <span>NimbusImage home</span>
      </v-tooltip>
      <bread-crumbs />
      <v-spacer />
      <v-tooltip bottom>
        <template v-slot:activator="{ on, attrs }">
          <v-btn
            color="primary"
            class="ml-4"
            :to="{ name: 'newdataset' }"
            :disabled="!store.isLoggedIn"
            v-bind="attrs"
            v-on="on"
          >
            Upload Data
          </v-btn>
        </template>
        <span>Upload a new dataset</span>
      </v-tooltip>
      <v-divider class="ml-1" vertical />
      <template v-if="store.dataset && routeName === 'datasetview'">
        <v-tooltip bottom>
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              class="ml-4"
              v-bind="attrs"
              v-on="on"
              @click.stop="toggleRightPanel('analyzePanel')"
            >
              <v-badge dot color="red" :value="hasUncomputedProperties">
                Measure objects
              </v-badge>
            </v-btn>
          </template>
          <span
            >Measure properties of your objects, like "area" or "number of
            spots"</span
          >
        </v-tooltip>
        <v-tooltip bottom>
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              class="ml-4"
              v-bind="attrs"
              v-on="on"
              @click.stop="
                toggleRightPanel('annotationPanel');
                annotationPanelBadge = false;
              "
            >
              <v-badge dot color="green" :value="annotationPanelBadge">
                Object list
              </v-badge>
            </v-btn>
          </template>
          <span
            >List of all objects in the dataset, including their properties, and
            various actions on them</span
          >
        </v-tooltip>
        <v-divider class="ml-4" vertical />
        <v-tooltip bottom>
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              class="ml-4"
              v-bind="attrs"
              v-on="on"
              @click.stop="toggleRightPanel('snapshotPanel')"
            >
              Snapshots
            </v-btn>
          </template>
          <span
            >Snapshots for bookmarking and downloading cropped regions in your
            dataset</span
          >
        </v-tooltip>
        <v-tooltip bottom>
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              class="ml-4"
              v-bind="attrs"
              v-on="on"
              @click.stop="toggleRightPanel('settingsPanel')"
            >
              Settings
            </v-btn>
          </template>
          <span>Image and object display settings</span>
        </v-tooltip>
      </template>
      <div class="mx-4 d-flex align-center">
        <v-tooltip bottom>
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              icon
              v-bind="attrs"
              v-on="on"
              @click="helpPanelIsOpen = !helpPanelIsOpen"
            >
              <v-icon>mdi-help-circle-outline</v-icon>
            </v-btn>
          </template>
          <span>Show the heads up display for commands and hotkeys</span>
        </v-tooltip>
        <server-status />
        <user-menu />
        <v-tooltip bottom>
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              icon
              v-bind="attrs"
              v-on="on"
              @click="chatbotOpen = !chatbotOpen"
            >
              <v-icon>mdi-chat</v-icon>
            </v-btn>
          </template>
          <span
            >Open NimbusImage chat for help with solving your particular image
            analysis problems</span
          >
        </v-tooltip>
      </div>
    </v-app-bar>

    <chat-component v-if="chatbotOpen" @close="chatbotOpen = false" />

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
import HelpPanel from "./components/HelpPanel.vue";
import BreadCrumbs from "./layout/BreadCrumbs.vue";
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import propertyStore from "@/store/properties";
import { logError } from "@/utils/log";
import { IHotkey } from "@/utils/v-mousetrap";
import ChatComponent from "@/components/ChatComponent.vue";

@Component({
  components: {
    HelpPanel,
    AnnotationBrowser,
    UserMenu,
    BreadCrumbs,
    ServerStatus,
    AnalyzeAnnotations,
    AnnotationsSettings,
    Snapshots,
    ChatComponent,
  },
})
export default class App extends Vue {
  readonly store = store;
  readonly propertyStore = propertyStore;

  readonly appHotkeys: IHotkey = {
    bind: "tab",
    handler: this.toggleHelpDialogUsingHotkey,
    data: {
      section: "Global",
      description: "Toggle help dialog",
    },
  };

  get helpPanelIsOpen() {
    return this.store.isHelpPanelOpen;
  }

  set helpPanelIsOpen(isOpen: boolean) {
    this.store.setIsHelpPanelOpen(isOpen);
  }

  snapshotPanel = false;
  snapshotPanelFull = false;

  annotationPanel = false;

  settingsPanel = false;

  analyzePanel = false;

  chatbotOpen = false;

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
      .then((resp) => {
        this.store.setToolTemplateList(resp.data);
      })
      .catch((err) => {
        logError(err);
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

  toggleHelpDialogUsingHotkey(_elem: any, e: Event) {
    e.preventDefault();
    this.helpPanelIsOpen = !this.helpPanelIsOpen;
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

.logo-icon {
  height: 50px;

  margin-top: 10px;
}

.v-menu__content {
  z-index: 10000 !important;
}
</style>
