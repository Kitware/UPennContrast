<template>
  <div class="viewer">
    <viewer-toolbar class="toolbar" />
    <display-layers class="layers" />
  </div>
</template>
<script lang="ts">
import { Vue, Component, Inject, Prop } from "vue-property-decorator";
import ViewerToolbar from "@/components/ViewerToolbar.vue";
import DisplayLayers from "@/components/DisplayLayers.vue";
import store from "@/store";

@Component({
  components: {
    ViewerToolbar,
    DisplayLayers
  }
})
export default class Viewer extends Vue {
  readonly store = store;

  created() {
    document.addEventListener("keydown", this.onKeyDown);
  }

  beforeDestroy() {
    document.removeEventListener("keydown", this.onKeyDown);
  }

  private onKeyDown(evt: KeyboardEvent) {
    // handle hot keys
    if (/^\d$/g.test(evt.key)) {
      this.store.handleHotkey(parseInt(evt.key, 10));
    }
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
}

.toolbar {
  position: absolute;
  top: 0.5em;
  left: 0.5em;
  width: 20em;
}

.layers {
  position: absolute;
  top: 6em;
  left: 0.5em;
  width: 20em;
}
</style>
