<template>
  <v-container>
    <v-row>
      <v-btn @click="addNewFilter">
        Add new region filter
      </v-btn>
    </v-row>
    <v-row v-for="filter in filters" :key="filter.id">
      <v-checkbox
        :value="filter.enabled"
        :input-value="filter.enabled"
        @click="toggleEnabled(filter.id)"
      ></v-checkbox>
      <v-col>{{ filter.id }}</v-col>
      <v-col
        ><v-btn icon small @click="removeFilter(filter.id)"
          ><v-icon>mdi-close</v-icon></v-btn
        ></v-col
      >
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";

import filterStore from "@/store/filters";

import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import PropertyFilterHistogram from "@/components/AnnotationBrowser/AnnotationProperties/PropertyFilterHistogram.vue";

@Component({
  components: {
    TagFilterEditor,
    PropertyFilterHistogram
  }
})
export default class ROIFilters extends Vue {
  readonly filterStore = filterStore;

  addNewFilter() {
    this.filterStore.newROIFilter();
  }

  removeFilter(id: string) {
    this.filterStore.removeROIFilter(id);
  }

  get filters() {
    return this.filterStore.roiFilters;
  }

  toggleEnabled(id: string) {
    this.filterStore.toggleRoiFilterEnabled(id);
  }
}
</script>
