<template>
  <div class="viewer">
    <aside class="side">
      <viewer-toolbar class="toolbar">
        <!-- <contrast-panels /> -->
        <display-layers />
      </viewer-toolbar>
    </aside>
    <v-card v-show="drawer" class="custom-drawer">
      <contrast-panels />
    </v-card>
    <image-viewer class="main" />
    <v-btn
      :style="{ zIndex: 200 }"
      fixed
      small
      dark
      fab
      left
      bottom
      color="primary"
      @click="drawer = !drawer"
    >
      <v-icon>mdi-menu</v-icon>
    </v-btn>
  </div>
</template>
<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import ViewerToolbar from "@/components/ViewerToolbar.vue";
import DisplayLayers from "@/components/DisplayLayers.vue";
import ImageViewer from "@/components/ImageViewer.vue";
import ContrastPanels from "@/components/ContrastPanels.vue";

import store from "@/store";
import annotationStore from "@/store/annotation";
import propertiesStore from "@/store/properties";

@Component({
  components: {
    ViewerToolbar,
    DisplayLayers,
    ImageViewer,
    ContrastPanels
  }
})
export default class Viewer extends Vue {
  readonly store = store;
  readonly annotationStore = annotationStore;
  readonly propertyStore = propertiesStore;

  drawer: boolean = false;

  mounted() {
    this.datasetChanged();
    this.configurationChanged();
  }

  data() {
    return {
      drawer: false // Initialize drawer to be closed
    };
  }

  get dataset() {
    return this.store.dataset;
  }

  get configuration() {
    return this.store.configuration;
  }

  // Fetch annotations for the current dataset
  @Watch("dataset")
  datasetChanged() {
    this.annotationStore.fetchAnnotations();
    this.propertyStore.fetchPropertyValues();
  }

  @Watch("configuration")
  configurationChanged() {
    this.propertyStore.fetchProperties();
  }
}
</script>

<style lang="scss" scoped>
.viewer {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
}

.side {
  width: 20em;
}

.toolbar {
  padding: 0.5em;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-bottom: 0;
}

.main {
  flex: 1 1 0;
}
</style>
<style scoped>
.custom-drawer {
  position: fixed;
  display: flex;
  flex-direction: row;
  justify-content: start;
  align-items: flex-start;
  bottom: 0;
  width: 50%;
  height: 200px;
  z-index: 200;
}
</style>
