<template>
  <!-- layer -->
  <v-select
    :items="layerItems"
    item-text="label"
    dense
    v-model="layer"
    :label="label"
  />
</template>

<script lang="ts">
import { Vue, Component, Prop, VModel } from "vue-property-decorator";
import store from "@/store";
import toolsStore from "@/store/tool";

// Interface element selecting a layer
@Component({
  components: {}
})
export default class LayerSelect extends Vue {
  readonly store = store;
  readonly toolsStore = toolsStore;

  // Adds an "Any" selection choice
  @Prop()
  readonly any: any;

  @Prop()
  readonly label: any;

  @VModel({ type: Number }) layer!: Number;

  get layers() {
    return this.store.configuration?.view.layers || [];
  }

  get layerItems() {
    const layers: { label: string; value: number | null }[] = this.layers.map(
      (layer, index) => ({
        label: layer.name,
        value: index
      })
    );
    if (this.any !== undefined) {
      layers.push({
        label: "Any",
        value: null
      });
    }
    return layers;
  }
}
</script>
