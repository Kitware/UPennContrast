<template>
  <v-expansion-panel>
    <v-expansion-panel-header>
      Actions
    </v-expansion-panel-header>
    <v-expansion-panel-content>
      <v-container>
        <v-row>
          <v-col class="pa-1">
            <v-btn
              v-if="selectionFilterEnabled"
              @click.native="clearSelection"
              block
            >
              Clear selection filter
            </v-btn>
            <v-btn v-else @click.native="filterBySelection" block>
              Use selection as filter
            </v-btn>
          </v-col>
          <v-col class="pa-1">
            <annotation-csv-dialog
              block
              :annotations="filteredAnnotations"
              :propertyIds="propertyIds"
            ></annotation-csv-dialog>
          </v-col>
        </v-row>
        <v-row>
          <v-col class="pa-1">
            <annotation-import block />
          </v-col>
          <v-col class="pa-1">
            <annotation-export block />
          </v-col>
        </v-row>
      </v-container>
    </v-expansion-panel-content>
  </v-expansion-panel>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import annotationStore from "@/store/annotation";
import propertyStore from "@/store/properties";
import filterStore from "@/store/filters";

import AnnotationCsvDialog from "@/components/AnnotationBrowser/AnnotationCSVDialog.vue";
import AnnotationExport from "@/components/AnnotationBrowser/AnnotationExport.vue";
import AnnotationImport from "@/components/AnnotationBrowser/AnnotationImport.vue";

@Component({
  components: {
    AnnotationCsvDialog,
    AnnotationExport,
    AnnotationImport
  }
})
export default class AnnotationActions extends Vue {
  readonly annotationStore = annotationStore;
  readonly propertyStore = propertyStore;
  readonly filterStore = filterStore;

  get filteredAnnotations() {
    return this.filterStore.filteredAnnotations;
  }

  get selectionFilterEnabled() {
    return this.filterStore.selectionFilter.enabled;
  }

  get propertyIds() {
    return this.propertyStore.properties.map(p => p.id);
  }

  clearSelection() {
    this.filterStore.clearSelection();
  }
  filterBySelection() {
    this.filterStore.addSelectionAsFilter();
  }
}
</script>
