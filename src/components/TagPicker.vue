<template>
  <!-- tags -->
  <v-combobox
    v-model="tags"
    :items="tagList"
    :search-input.sync="tagSearchInput"
    multiple
    hide-selected
    hide-details
    small-chips
    dense
    label="Tags"
    :disabled="disabled"
    @change="onTagChange"
    ref="combobox"
  >
    <template v-slot:selection="{ attrs, index, item, parent }">
      <v-chip
        :key="index"
        class="pa-2"
        v-bind="attrs"
        close
        pill
        x-small
        @click:close="parent.selectItem(item)"
      >
        {{ item }}
      </v-chip>
    </template>
  </v-combobox>
</template>

<script lang="ts">
import { Vue, Component, VModel, Prop } from "vue-property-decorator";
import store from "@/store";
import annotationStore from "@/store/annotation";

// Interface element for the input of annotation tags
@Component({
  components: {},
})
export default class TagPicker extends Vue {
  readonly store = store;
  readonly annotationStore = annotationStore;

  @Prop({ default: false })
  readonly disabled!: boolean;

  @VModel({ type: Array }) tags!: string[];

  get tagList(): string[] {
    return Array.from(
      new Set([...this.annotationStore.annotationTags, ...this.store.toolTags]),
    );
  }

  tagSearchInput: string = "";
  get layers() {
    return this.store.layers;
  }

  $refs!: {
    combobox: any;
  };

  onTagChange() {
    // Close the combobox and remove focus
    Vue.nextTick(() => {
      if (this.$refs.combobox) {
        this.$refs.combobox.blur();
      }
    });
  }
}
</script>
