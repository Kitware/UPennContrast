<template>
  <div class="viewer">
    <aside class="side">
      <viewer-toolbar class="toolbar">
        <div class="layers">
          <display-layers />
        </div>
      </viewer-toolbar>
    </aside>
    <image-viewer class="main" />
  </div>
</template>
<script lang="ts">
import { Vue, Component, Inject, Prop } from "vue-property-decorator";
import ViewerToolbar from "@/components/ViewerToolbar.vue";
import DisplayLayers from "@/components/DisplayLayers.vue";
import ImageViewer from "@/components/ImageViewer.vue";
import store from "@/store";

@Component({
  components: {
    ViewerToolbar,
    DisplayLayers,
    ImageViewer
  }
})
export default class Viewer extends Vue {
  readonly store = store;
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

.layers {
  flex: 1 1 0;
  overflow: auto;
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
