<template>
  <v-container>
    <v-row>
      <v-col>
        <!-- tags -->
        <tag-picker v-model="newTags"></tag-picker>
      </v-col>
      <v-col>
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
import toolsStore from "@/store/tool";
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
  readonly toolsStore = toolsStore;

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
    return this.toolsStore.tools
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

  get tagsLabelWithDefault() {
    return this.tagsLabel || "Restrict to Tags";
  }

  get layerLabelWithDefault() {
    return this.layerLabel || "Restrict to layer";
  }

  @Watch("newTags")
  changed() {
    this.tagSearchInput = "";
    this.$emit("input", { tags: this.newTags, layer: this.selectedLayer });
    this.$emit("change");
  }
}
</script>
