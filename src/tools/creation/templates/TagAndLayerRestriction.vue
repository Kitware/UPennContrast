<template>
  <v-container>
    <v-row class="pa-0">
      <v-col class="pa-0 pr-2">
        <!-- tags -->
        <tag-picker v-model="newTags"></tag-picker>
      </v-col>
      <v-col class="pa-0 pr-2">
        <!-- layers -->
        <layer-select
          any
          :label="layerLabelWithDefault"
          v-model="selectedLayer"
        ></layer-select>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
import { IToolConfiguration } from "@/store/model";
import LayerSelect from "@/components/LayerSelect.vue";
import TagPicker from "@/components/TagPicker.vue";

// Tool creation interface element for picking tags and layers for connections
@Component({
  components: {
    LayerSelect,
    TagPicker
  }
})
export default class TagAndLayerRestriction extends Vue {
  readonly store = store;

  newTags: string[] = [];
  selectedLayer: number | null = null;

  @Prop()
  readonly value!: any;

  mounted() {
    this.reset();
  }

  reset() {
    this.newTags = [];
    this.selectedLayer = null;
    this.changed();
  }

  get dataset() {
    return this.store.dataset;
  }

  // list of existing tags for autocomplete
  get tagList(): string[] {
    return this.store.tools
      .filter(
        (tool: IToolConfiguration) =>
          (tool.type === "create" || tool.type === "snap") &&
          tool.values.annotation
      )
      .map((tool: IToolConfiguration) => tool.values.annotation.tags)
      .flat();
  }

  tagSearchInput: string = "";

  @Prop()
  readonly template!: any;

  @Prop()
  readonly tagsLabel!: string;

  @Prop()
  readonly layerLabel!: string;

  get layerLabelWithDefault() {
    return this.layerLabel || "Filter by layer";
  }

  @Watch("newTags")
  @Watch("selectedLayer")
  changed() {
    this.tagSearchInput = "";
    this.$emit("input", { tags: this.newTags, layer: this.selectedLayer });
    this.$emit("change");
  }
}
</script>
