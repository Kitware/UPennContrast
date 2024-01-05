<template>
  <div>
    <v-btn small @click="addNewFilter"> Add region filter </v-btn>
    <div class="d-flex flex-column">
      <div
        v-for="filter in filters"
        :key="filter.id"
        class="d-flex justify-space-between align-center"
      >
        <v-simple-checkbox
          class="d-inline ml-2"
          :value="filter.enabled"
          :input-value="filter.enabled"
          @click="toggleEnabled(filter.id)"
        />
        {{ filter.id }}
        <v-btn class="mx-2" icon small @click="removeFilter(filter.id)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";

import filterStore from "@/store/filters";

import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";

@Component({ components: { TagFilterEditor } })
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
