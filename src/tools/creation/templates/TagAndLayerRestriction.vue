<template>
  <v-container>
    <v-row class="pa-0">
      <v-col class="pa-0 pr-2 d-flex">
        <!-- tags -->
        <tag-picker v-model="newTags"></tag-picker>
        <v-btn
          v-if="inclusiveToggle"
          class="mx-2"
          :title="
            `Current tags selection mode: ${
              areTagsInclusive ? 'inclusive' : 'exclusive'
            }`
          "
          x-small
          fab
          @click="areTagsInclusive = !areTagsInclusive"
        >
          <v-icon>
            {{ areTagsInclusive ? "mdi-set-all" : "mdi-set-center" }}
          </v-icon>
        </v-btn>
      </v-col>
      <v-col class="pa-0 pr-2 d-flex">
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

interface IRestrictionSetup {
  tags: string[];
  layer: number | null;
  tagsInclusive?: boolean;
}

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
  areTagsInclusive: boolean = true;
  selectedLayer: number | null = null;

  @Prop()
  readonly value?: IRestrictionSetup;

  @Prop({ default: true })
  readonly inclusiveToggle!: boolean;

  mounted() {
    this.updateFromValue();
  }

  @Watch("value")
  updateFromValue() {
    if (!this.value) {
      return;
    }
    this.newTags = this.value.tags;
    this.areTagsInclusive = !!this.value.tagsInclusive;
    this.selectedLayer = this.value.layer;
  }

  reset() {
    this.newTags = [];
    this.areTagsInclusive = true;
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
  @Watch("areTagsInclusive")
  changed() {
    this.tagSearchInput = "";
    const result: IRestrictionSetup = {
      tags: this.newTags,
      layer: this.selectedLayer
    };
    if (this.inclusiveToggle) {
      result.tagsInclusive = this.areTagsInclusive;
    }
    this.$emit("input", result);
    this.$emit("change");
  }
}
</script>
