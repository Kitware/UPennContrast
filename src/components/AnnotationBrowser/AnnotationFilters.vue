<template>
  <v-container class="filter-main-container">
    <tag-filter-editor
      class="filter-element"
      v-model="tagFilter"
      style="flex-basis: content"
    />
    <v-switch
      class="filter-element"
      label="Current frame only"
      v-model="onlyCurrentFrame"
      dense
      hide-details
    />
    <v-switch
      class="filter-element"
      label="Show annotations from hidden layers"
      v-model="showAnnotationsFromHiddenLayers"
      dense
      hide-details
    />
    <property-filter-selector class="filter-element" />
    <property-filter-histogram
      v-for="(propertyPath, idx) in propertyPaths"
      :key="'property ' + idx"
      :propertyPath="propertyPath"
    />
    <annotation-id-filters class="filter-element" />
    <roi-filters class="filter-element" />
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";

import filterStore from "@/store/filters";
import store from "@/store";

import { ITagAnnotationFilter } from "@/store/model";
import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import PropertyFilterHistogram from "@/components/AnnotationBrowser/AnnotationProperties/PropertyFilterHistogram.vue";
import RoiFilters from "@/components/AnnotationBrowser/ROIFilters.vue";
import AnnotationIdFilters from "@/components/AnnotationBrowser/AnnotationIdFilters.vue";
import PropertyFilterSelector from "@/components/AnnotationBrowser/PropertyFilterSelector.vue";

@Component({
  components: {
    PropertyFilterHistogram,
    RoiFilters,
    TagFilterEditor,
    AnnotationIdFilters,
    PropertyFilterSelector,
  },
})
export default class AnnotationFilters extends Vue {
  readonly filterStore = filterStore;
  readonly store = store;

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

  get onlyCurrentFrame() {
    return this.filterStore.onlyCurrentFrame;
  }

  set onlyCurrentFrame(value: boolean) {
    this.filterStore.setOnlyCurrentFrame(value);
  }

  get propertyPaths() {
    return this.filterStore.filterPaths;
  }

  get propertyFilters() {
    return this.filterStore.propertyFilters;
  }

  get showAnnotationsFromHiddenLayers() {
    return this.store.showAnnotationsFromHiddenLayers;
  }

  set showAnnotationsFromHiddenLayers(value: boolean) {
    this.store.setShowAnnotationsFromHiddenLayers(value);
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
