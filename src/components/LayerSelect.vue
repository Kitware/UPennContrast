<template>
  <!-- layer -->
  <v-select
    v-bind="$attrs"
    :items="layerItems"
    item-text="label"
    dense
    v-model="layer"
    :label="label"
  />
</template>

<script lang="ts">
import { Vue, Component, Prop, VModel, Watch } from "vue-property-decorator";
import store from "@/store";

// Interface element selecting a layer
@Component({})
export default class LayerSelect extends Vue {
  readonly store = store;

  // Adds an "Any" selection choice
  @Prop()
  readonly any: any;

  @Prop()
  readonly label: any;

  @VModel() layer!: string | null;

  mounted() {
    this.ensureLayer();
  }

  @Watch("layer")
  ensureLayer() {
    if (this.any) {
      if (this.layer === undefined) {
        this.layer = null;
      }
    } else {
      if (this.layer == null) {
        this.layer = this.layerItems[0].value;
      }
    }
  }

  get layers() {
    return this.store.layers;
  }

  get layerItems() {
    const layers: { label: string; value: string | null }[] = this.layers.map(
      (layer) => ({
        label: layer.name,
        value: layer.id,
      }),
    );
    if (this.any !== undefined) {
      Vue.set(layers, layers.length, {
        label: "Any",
        value: null,
      });
    }
    return layers;
  }
}
</script>
