<template>
  <v-card>
    <v-card-title class="pa-1">
      Filters
    </v-card-title>
    <v-card-text class="pa-2">
      <v-container>
        <v-row>
          <v-col class="pa-0">
            <tag-filter-editor v-model="tagFilter"></tag-filter-editor>
          </v-col>
        </v-row>
        <v-row v-for="propertyId in propertyIds" :key="propertyId">
          <property-filter-histogram
            :propertyId="propertyId"
          ></property-filter-histogram>
        </v-row>
      </v-container>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch, VModel } from "vue-property-decorator";

import filterStore from "@/store/filters";

import { IPropertyAnnotationFilter, ITagAnnotationFilter } from "@/store/model";
import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import PropertyFilterHistogram from "@/components/AnnotationBrowser/AnnotationProperties/PropertyFilterHistogram.vue";

@Component({
  components: {
    TagFilterEditor,
    PropertyFilterHistogram
  }
})
export default class AnnotationFilter extends Vue {
  readonly filterStore = filterStore;
  @Prop()
  readonly additionalTags!: string[];

  tagSearchInput: string = "";

  get tagFilter() {
    return this.filterStore.tagFilter;
  }
  set tagFilter(filter: ITagAnnotationFilter) {
    this.filterStore.setTagFilter(filter);
  }

  get propertyIds() {
    return this.filterStore.filterIds;
  }

  get propertyFilters() {
    return this.filterStore.propertyFilters;
  }
}
</script>
