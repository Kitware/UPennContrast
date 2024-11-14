<template>
  <div>
    <v-btn small @click="openNewFilterDialog">Add annotation list filter</v-btn>
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
        <v-btn text @click="editFilter(filter)">
          {{ filter.id }} ({{ filter.annotationIds.length }} IDs)
        </v-btn>
        <v-btn class="mx-2" icon small @click="removeFilter(filter.id)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </div>
    </div>

    <v-dialog v-model="dialog" max-width="500px">
      <v-card>
        <v-card-title>
          {{ editingFilter ? "Edit Filter" : "New Annotation List Filter" }}
        </v-card-title>
        <v-card-text>
          <v-textarea
            v-model="annotationIdsInput"
            label="Enter annotation IDs (separated by commas, spaces, or newlines)"
            rows="5"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="dialog = false">Cancel</v-btn>
          <v-btn color="primary" text @click="saveFilter">
            {{ editingFilter ? "Update" : "Add Filter" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import filterStore from "@/store/filters";
import { IIdAnnotationFilter } from "@/store/model";

@Component
export default class AnnotationIDFilters extends Vue {
  readonly filterStore = filterStore;

  dialog = false;
  annotationIdsInput = "";
  editingFilter: IIdAnnotationFilter | null = null;

  get filters() {
    return this.filterStore.annotationIdFilters;
  }

  openNewFilterDialog() {
    this.editingFilter = null;
    this.annotationIdsInput = "";
    this.dialog = true;
  }

  editFilter(filter: IIdAnnotationFilter) {
    this.editingFilter = filter;
    this.annotationIdsInput = filter.annotationIds.join("\n");
    this.dialog = true;
  }

  saveFilter() {
    const annotationIds = this.annotationIdsInput
      .split(/[\s,;]+/)
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (this.editingFilter) {
      console.log("updating", this.editingFilter.id, annotationIds);
      this.filterStore.updateAnnotationIdFilter({
        id: this.editingFilter.id,
        annotationIds: annotationIds,
      });
    } else {
      this.filterStore.newAnnotationIdFilter(annotationIds);
    }

    this.dialog = false;
    this.annotationIdsInput = "";
    this.editingFilter = null;
  }

  removeFilter(id: string) {
    this.filterStore.removeAnnotationIdFilter(id);
  }

  toggleEnabled(id: string) {
    this.filterStore.toggleAnnotationIdFilterEnabled(id);
  }
}
</script>
