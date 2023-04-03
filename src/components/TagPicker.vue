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
import toolsStore from "@/store/tool";
import { IToolConfiguration } from "@/store/model";

// Interface element for the input of annotation tags
@Component({
  components: {}
})
export default class TagPicker extends Vue {
  readonly store = store;
  readonly annotationStore = annotationStore;
  readonly toolsStore = toolsStore;

  @Prop({ default: false })
  readonly disabled!: boolean;

  @VModel({ type: Array }) tags!: string[];

  get tagList(): string[] {
    const tagSet: Set<string> = new Set();
    // Tags from annotations
    for (const { tags } of this.annotationStore.annotations) {
      for (const tag of tags) {
        tagSet.add(tag);
      }
    }
    // Tags from tools
    for (const tool of this.toolsStore.tools) {
      if (tool.values?.annotation?.tags) {
        const tags = tool.values.annotation.tags;
        for (const tag of tags) {
          tagSet.add(tag);
        }
      }
    }
    return Array.from(tagSet);
  }

  tagSearchInput: string = "";
  get layers() {
    return this.store.configuration?.layers || [];
  }
}
</script>
