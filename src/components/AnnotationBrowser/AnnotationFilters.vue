<template>
  <v-container class="filter-main-container">
    <shape-filter-editor
      class="filter-element"
      id="shape-filter"
      v-model="shapeFilter"
    />
    <tag-filter-editor class="filter-element" v-model="tagFilter" />
    <roi-filters class="filter-element" />
    <template v-for="(propertyPath, idx) in propertyPaths">
      <property-filter-histogram
        :key="'property ' + idx"
        :propertyPath="propertyPath"
      />
    </template>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";

import filterStore from "@/store/filters";

import { ITagAnnotationFilter, IShapeAnnotationFilter } from "@/store/model";
import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import ShapeFilterEditor from "@/components/AnnotationBrowser/ShapeFilterEditor.vue";
import PropertyFilterHistogram from "@/components/AnnotationBrowser/AnnotationProperties/PropertyFilterHistogram.vue";
import RoiFilters from "@/components/AnnotationBrowser/ROIFilters.vue";
@Component({
  components: {
    PropertyFilterHistogram,
    RoiFilters,
    ShapeFilterEditor,
    TagFilterEditor
  }
})
export default class AnnotationFilters extends Vue {
  readonly filterStore = filterStore;

  @Prop()
  readonly additionalTags!: string[];

  tagSearchInput: string = "";

  show = false;

  get tagFilter() {
    return this.filterStore.tagFilter;
  }
  set tagFilter(filter: ITagAnnotationFilter) {
    this.filterStore.setTagFilter(filter);
  }

  get shapeFilter() {
    return this.filterStore.shapeFilter;
  }
  set shapeFilter(filter: IShapeAnnotationFilter) {
    this.filterStore.setShapeFilter(filter);
  }

  get propertyPaths() {
    return this.filterStore.filterPaths;
  }

  get propertyFilters() {
    return this.filterStore.propertyFilters;
  }
}
</script>

<style lang="scss">
.filter-main-container {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  align-content: center;
  justify-content: space-between;
}

.filter-main-container .v-text-field {
  margin: 0;
}

.filter-element {
  display: flex;
  align-items: center;
  align-content: center;
  flex: 1;
  max-width: fit-content;
  margin-top: 12px;
  margin-bottom: 12px;
  margin-left: 10px;
  margin-right: 10px;
}

#shape-filter .v-select__slot {
  max-width: 70px;
}
</style>
