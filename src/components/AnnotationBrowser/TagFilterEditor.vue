<template>
  <div class="body-1 d-flex flex-wrap">
    <tag-cloud-picker v-model="tags" :allSelected.sync="allSelected" />
    <div>
      Tag match:
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
    </div>
  </div>
</template>

<script lang="ts">
import { Vue, Component, VModel } from "vue-property-decorator";
import { ITagAnnotationFilter } from "@/store/model";
import TagCloudPicker from "@/components/TagCloudPicker.vue";

@Component({
  components: {
    TagCloudPicker,
  },
})
export default class TagFilterEditor extends Vue {
  @VModel({ type: Object }) filter!: ITagAnnotationFilter;

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
    this.filter = { ...this.filter, tags };
  }

  get allSelected() {
    return !this.filter.enabled;
  }

  set allSelected(allSelected: boolean) {
    const exclusive = allSelected ? false : this.filter.exclusive;
    this.filter = { ...this.filter, enabled: !allSelected, exclusive };
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
