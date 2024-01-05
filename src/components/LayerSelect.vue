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
@Component({
  components: {},
})
export default class LayerSelect extends Vue {
  readonly store = store;

  // Adds an "Any" selection choice
  @Prop()
  readonly any: any;

  @Prop()
  readonly label: any;

  @VModel({ type: String }) layer!: string | null;

  mounted() {
    this.ensureLayer();
  }

  @Watch("layer")
  ensureLayer() {
    if (
      this.layer === undefined ||
      (this.any === undefined && this.layer === null && this.layerItems.length)
    ) {
      // "Any" is not an option but layer is null and there are options
      this.layer = this.layerItems[0].value;
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
