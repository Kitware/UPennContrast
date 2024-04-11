<template>
  <div class="viewer">
    <aside class="side">
      <viewer-toolbar class="toolbar">
        <!-- <contrast-panels /> -->
        <display-layers />
      </viewer-toolbar>
    </aside>
    <image-viewer class="main" />
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
import { Debounce } from "@/utils/debounce";

@Component({
  components: {
    ViewerToolbar,
    DisplayLayers,
    ImageViewer,
    ContrastPanels,
  },
})
export default class Viewer extends Vue {
  readonly store = store;
  readonly annotationStore = annotationStore;
  readonly propertyStore = propertiesStore;

  mounted() {
    this.datasetChanged();
    this.configurationChanged();
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

  async changeQuery(param: string, value: string) {
    const old = this.$route.query[param];
    if (old === value) {
      return;
    }
    await this.$router.replace({
      query: {
        ...this.$route.query,
        [param]: value,
      },
    });
  }

  get xy() {
    return this.store.xy;
  }

  get z() {
    return this.store.z;
  }

  get time() {
    return this.store.time;
  }

  get unrollXY() {
    return this.store.unrollXY;
  }

  get unrollZ() {
    return this.store.unrollZ;
  }

  get unrollT() {
    return this.store.unrollT;
  }

  get layerMode() {
    return this.store.layerMode;
  }

  @Watch("xy")
  @Debounce(500)
  updateQueryParamsXY() {
    this.changeQuery("xy", this.xy.toString());
  }

  @Watch("z")
  @Debounce(500)
  updateQueryParamsZ() {
    this.changeQuery("z", this.z.toString());
  }

  @Watch("time")
  @Debounce(500)
  updateQueryParamsT() {
    this.changeQuery("time", this.time.toString());
  }

  @Watch("unrollXY")
  @Debounce(500)
  updateQueryParamsUnrollXY() {
    this.changeQuery("unrollXY", this.unrollXY.toString());
  }

  @Watch("unrollZ")
  @Debounce(500)
  updateQueryParamsUnrollZ() {
    this.changeQuery("unrollZ", this.unrollZ.toString());
  }

  @Watch("unrollT")
  @Debounce(500)
  updateQueryParamsUnrollT() {
    this.changeQuery("unrollT", this.unrollT.toString());
  }

  @Watch("layerMode")
  @Debounce(500)
  updateQueryParamsLayerMode() {
    this.changeQuery("layer", this.layerMode);
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
<style>
.toolbar .v-expansion-panel-content__wrap,
.toolbar .v-expansion-panel-header {
  padding-left: 1px;
  padding-right: 5px;
}
</style>
