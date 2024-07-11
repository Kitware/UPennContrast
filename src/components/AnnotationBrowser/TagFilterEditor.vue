<template>
  <div class="body-1">
    Show
    <v-select
      dense
      hide-details
      single-line
      class="mx-2 select-exclusive-filter"
      v-model="exclusive"
      :items="exclusiveItems"
      item-text="text"
      item-value="value"
    />
    <tag-cloud-picker v-model="tags" :availableTags="tagList" />
  </div>
</template>

<script lang="ts">
import { Vue, Component, VModel } from "vue-property-decorator";
import { ITagAnnotationFilter } from "@/store/model";
import TagCloudPicker from "@/components/TagCloudPicker.vue";
import store from "@/store";
import annotationStore from "@/store/annotation";

@Component({
  components: {
    TagCloudPicker,
  },
})
export default class TagFilterEditor extends Vue {
  @VModel({ type: Object }) filter!: ITagAnnotationFilter;

  readonly store = store;
  readonly annotationStore = annotationStore;

  readonly exclusiveItems = [
    {
      text: "Any",
      value: false,
    },
    {
      text: "Only",
      value: true,
    },
  ];

  get tags() {
    return this.filter.tags;
  }

  set tags(tags: string[]) {
    this.filter = { ...this.filter, enabled: true, tags };
  }

  get exclusive() {
    return this.filter.exclusive;
  }

  set exclusive(exclusive: boolean) {
    this.filter = { ...this.filter, enabled: true, exclusive };
  }

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
}
</script>

<style lang="scss">
.select-exclusive-filter .v-select__selections {
  width: 40px;
}
</style>