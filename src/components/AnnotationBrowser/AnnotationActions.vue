<template>
  <v-expansion-panel>
    <v-expansion-panel-header>
      Actions
    </v-expansion-panel-header>
    <v-expansion-panel-content>
      <v-container>
        <v-row>
          <v-col class="pa-1">
            <v-btn :disabled="!undoEntry || isDoing" @click.native="undo" block>
              <template v-if="undoEntry">
                Undo {{ undoEntry.actionName }}
              </template>
              <template v-else>
                No Undo Available
              </template>
            </v-btn>
          </v-col>
          <v-col class="pa-1">
            <v-btn :disabled="!redoEntry || isDoing" @click.native="redo" block>
              <template v-if="redoEntry">
                Redo {{ redoEntry.actionName }}
              </template>
              <template v-else>
                No Redo Available
              </template>
            </v-btn>
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-divider />
          </v-col>
        </v-row>
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
import store from "@/store";
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
  readonly store = store;
  readonly annotationStore = annotationStore;
  readonly propertyStore = propertyStore;
  readonly filterStore = filterStore;

  isDoing: boolean = false;

  get undoEntry() {
    return this.history.find(entry => !entry.isUndone);
  }

  get redoEntry() {
    return this.history.findLast(entry => entry.isUndone);
  }

  get filteredAnnotations() {
    return this.filterStore.filteredAnnotations;
  }

  get selectionFilterEnabled() {
    return this.filterStore.selectionFilter.enabled;
  }

  get propertyIds() {
    return this.propertyStore.properties.map(p => p.id);
  }

  get history() {
    return this.store.history;
  }

  async do(undo: boolean) {
    try {
      this.isDoing = true;
      await this.store.do(undo);
    } finally {
      this.isDoing = false;
    }
  }

  async undo() {
    await this.do(true);
  }

  async redo() {
    await this.do(false);
  }

  clearSelection() {
    this.filterStore.clearSelection();
  }
  filterBySelection() {
    this.filterStore.addSelectionAsFilter();
  }
}
</script>
