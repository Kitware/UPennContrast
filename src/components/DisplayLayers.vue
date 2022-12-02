<template>
  <v-expansion-panels multiple accordion v-mousetrap="mousetrapMaxMerge">
    <display-layer
      v-for="(l, index) in layers"
      :key="l.id"
      :value="l"
      :index="index"
      :globalZMaxMerge="globalZMaxMerge"
      :zMaxMergeUpdate="zMaxMergeUpdate"
    />
    <v-expansion-panel readonly class="add-layer">
      <v-btn @click="addLayer" icon>
        <v-icon>mdi-plus-circle</v-icon>
      </v-btn>
    </v-expansion-panel>
  </v-expansion-panels>
</template>
<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import DisplayLayer from "./DisplayLayer.vue";
import store from "@/store";

@Component({
  components: {
    DisplayLayer
  }
})
export default class DisplayLayers extends Vue {
  readonly store = store;

  globalZMaxMerge: boolean = false;
  zMaxMergeUpdate: number = 0;

  get layers() {
    return this.store.configuration ? this.store.configuration.view.layers : [];
  }

  addLayer() {
    this.store.addLayer();
  }

  globalZMaxMergeUpdate() {
    const currentMaxMerge = this.layers.every(
      layer => layer.z.type === "max-merge"
    );
    this.globalZMaxMerge = !currentMaxMerge;
    this.zMaxMergeUpdate++;
  }

  // Mousetrap bindings
  mousetrapMaxMerge = {
    bind: "z",
    handler: this.globalZMaxMergeUpdate
  };
}
</script>

<style lang="scss" scoped>
.add-layer {
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
