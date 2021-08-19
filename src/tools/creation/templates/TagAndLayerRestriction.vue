<template>
  <v-container>
    <v-row>
      <v-col>
        <v-combobox
          v-model="newTags"
          :items="tagList"
          :search-input.sync="tagSearchInput"
          @change="changed"
          :label="tagsLabelWithDefault"
          multiple
          hide-selected
          small-chips
        >
          <template v-slot:selection="{ attrs, index, item, parent }">
            <v-chip
              :key="index"
              class="pa-2"
              v-bind="attrs"
              close
              small
              @click:close="parent.selectItem(item)"
            >
              {{ item }}
            </v-chip>
          </template>
        </v-combobox>
      </v-col>
      <v-col>
        <v-select
          v-model="selectedLayer"
          :items="layerItems"
          item-text="label"
          :label="layerLabelWithDefault"
          @change="changed"
        >
        </v-select>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";

@Component({
  components: {}
})
export default class TagAndLayerRestriction extends Vue {
  readonly store = store;

  newTags: string[] = [];
  selectedLayer: number | null = null;

  @Prop()
  readonly value!: any;

  @Watch("value")
  watchValue() {
    this.initialize();
  }

  mounted() {
    this.initialize();
  }

  initialize() {
    if (this.value) {
      this.newTags = this.value.tags;
      this.selectedLayer = this.value.layer;
    } else {
      this.newTags = [];
      this.selectedLayer = null;
    }
  }

  get dataset() {
    return this.store.dataset;
  }

  get layers() {
    return this.store.configuration?.view.layers || [];
  }

  get layerItems() {
    return [
      ...this.layers.map((layer, index) => ({
        label: layer.name,
        value: index
      })),
      { label: "All", value: null }
    ];
  }

  tagList = []; // TODO: keep a list of existing tags from existing annotations
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

  changed() {
    this.tagSearchInput = "";
    this.$emit("input", { tags: this.newTags, layer: this.selectedLayer });
    this.$emit("change");
  }
}
</script>
