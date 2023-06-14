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
    <tag-picker v-model="tags" />
  </div>
</template>
<script lang="ts">
import { Vue, Component, VModel } from "vue-property-decorator";
import { ITagAnnotationFilter } from "@/store/model";
import TagPicker from "@/components/TagPicker.vue";

@Component({
  components: {
    TagPicker
  }
})
export default class TagFilterEditor extends Vue {
  @VModel({ type: Object }) filter!: ITagAnnotationFilter;

  readonly exclusiveItems = [
    {
      text: "Any",
      value: false
    },
    {
      text: "Only",
      value: true
    }
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
}
</script>

<style lang="scss">
.select-exclusive-filter .v-select__selections {
  width: 40px;
}
</style>
