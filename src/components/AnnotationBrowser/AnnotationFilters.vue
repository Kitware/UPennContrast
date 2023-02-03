<template>
  <v-expansion-panel dense>
    <v-expansion-panel-header>
      Filters <v-spacer></v-spacer>
    </v-expansion-panel-header>
    <v-expansion-panel-content>
      <v-container>
        <v-row>
          <v-col class="pa-0">
            <tag-filter-editor v-model="tagFilter"></tag-filter-editor>
          </v-col>
        </v-row>
        <v-row>
          <v-col class="pa-0">
            <shape-filter-editor v-model="shapeFilter"></shape-filter-editor>
          </v-col>
        </v-row>
        <v-row v-for="propertyId in propertyIds" :key="propertyId">
          <property-filter-histogram
            :propertyId="propertyId"
          ></property-filter-histogram>
        </v-row>
        <v-row>
          <v-col>
            <roi-filters></roi-filters>
          </v-col>
        </v-row>
      </v-container>
    </v-expansion-panel-content>
  </v-expansion-panel>
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

  get propertyIds() {
    return this.filterStore.filterIds;
  }

  get propertyFilters() {
    return this.filterStore.propertyFilters;
  }
}
</script>
