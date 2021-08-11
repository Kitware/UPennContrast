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
          :items="layerNames"
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

  get dataset() {
    return this.store.dataset;
  }

  // TODO: add "ALL", -1 ?
  get layers() {
    return this.store.configuration?.view.layers || [];
  }

  get layerNames() {
    return this.layers.map(layer => layer.name);
  }


  tagList = []; // TODO: keep a list of existing tags from existing annotations
  // channels = ["ch1", "brightField", "uiaeuaie"];

  tagSearchInput: string = "";
  newTags: string[] = [];
  selectedLayer: string = "";

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
