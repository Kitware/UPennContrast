<template>
  <div class="d-flex">
    <div class="mr-4">
      <select-all-none-chips @selectAll="selectAll" @selectNone="selectNone" />
    </div>
    <v-chip-group v-model="tags" column multiple active-class="selected-chip">
      <v-chip
        v-for="tag in tagList"
        :key="tag"
        :value="tag"
        :class="{
          'selected-chip': tags.includes(tag),
        }"
        outlined
        x-small
      >
        {{ tag }}
      </v-chip>
    </v-chip-group>
  </div>
</template>

<script lang="ts">
import { Vue, Component, VModel } from "vue-property-decorator";
import store from "@/store";
import annotationStore from "@/store/annotation";
import SelectAllNoneChips from "./SelectAllNoneChips.vue";

@Component({
  components: {
    SelectAllNoneChips,
  },
})
export default class TagCloudPicker extends Vue {
  @VModel({ type: Array, default: () => [] })
  tags!: string[];

  readonly store = store;
  readonly annotationStore = annotationStore;

  get tagList(): string[] {
    const tagSet: Set<string> = new Set();
    // Tags from annotations
    for (const { tags } of this.annotationStore.annotations) {
      for (const tag of tags) {
        tagSet.add(tag);
      }
    }
    // Tags from tools
    for (const tool of this.store.tools) {
      if (tool.values?.annotation?.tags) {
        const tags = tool.values.annotation.tags;
        for (const tag of tags) {
          tagSet.add(tag);
        }
      }
    }
    return Array.from(tagSet);
  }

  selectAll() {
    this.tags = [...this.tagList];
  }

  selectNone() {
    this.tags = [];
  }
}
</script>

<style lang="scss" scoped>
.selected-chip {
  border-color: #ffffff !important;
}
</style>
