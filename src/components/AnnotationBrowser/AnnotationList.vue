<template>
  <v-expansion-panel>
    <v-expansion-panel-header class="py-1">
      Annotation List
      <v-spacer></v-spacer>
      <v-btn v-if="selectionFilterEnabled" @click.native.stop="clearSelection">
        Clear selection filter
      </v-btn>
      <v-btn v-else @click.native.stop="filterBySelection">
        Use selection as filter
      </v-btn>
      <v-spacer></v-spacer>
      <annotation-csv-dialog
        :annotations="filtered"
        :propertyIds="propertyIds"
      ></annotation-csv-dialog>
    </v-expansion-panel-header>
    <v-expansion-panel-content>
      <v-dialog v-model="annotationFilteredDialog">
        <v-card>
          <v-card-title>
            Annotation does not pass current filtering criteria
          </v-card-title>
          <v-card-actions>
            <v-spacer />
            <v-btn @click.native="annotationFilteredDialog = false">OK</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
      <v-data-table
        :items="filtered"
        :headers="headers"
        v-model="selected"
        item-key="id"
        show-select
        :options.sync="tableOptions"
      >
        <template v-slot:body="{ items }">
          <tbody>
            <tr
              v-for="item in items"
              :key="item.id"
              @mouseover="hover(item.id)"
              @mouseleave="hover(null)"
              :class="item.id === hoveredId ? 'is-hovered' : ''"
              :ref="item.id"
            >
              <td :class="tableItemClass">
                <v-checkbox
                  hide-details
                  multiple
                  :value="item"
                  v-model="selected"
                ></v-checkbox>
              </td>
              <td :class="tableItemClass">
                <span>{{ getAnnotationIndex(item.id) }}</span>
              </td>
              <td :class="tableItemClass">
                <span>
                  {{ item.shape }}
                </span>
              </td>
              <td :class="tableItemClass">
                <span>
                  <v-chip
                    v-for="tag in item.tags"
                    :key="tag"
                    x-small
                    @click="clickedTag(tag)"
                    >{{ tag }}</v-chip
                  >
                </span>
              </td>
              <td :class="tableItemClass">
                <v-text-field
                  hide-details
                  :value="item.name || ''"
                  dense
                  flat
                  outlined
                  @change="updateAnnotationName($event, item.id)"
                >
                </v-text-field>
              </td>
              <td
                v-for="propertyId in propertyIds"
                :key="propertyId"
                :class="tableItemClass"
              >
                <span>{{ item[propertyId] }}</span>
              </td>
            </tr>
          </tbody>
        </template>
      </v-data-table>
    </v-expansion-panel-content>
  </v-expansion-panel>
</template>

<script lang="ts">
import { Vue, Component, Emit, Watch } from "vue-property-decorator";
import store from "@/store";
import annotationStore from "@/store/annotation";
import propertyStore from "@/store/properties";
import filterStore from "@/store/filters";

import {
  AnnotationNames,
  IAnnotation,
  IAnnotationProperty
} from "@/store/model";

import AnnotationCsvDialog from "@/components/AnnotationBrowser/AnnotationCSVDialog.vue";

@Component({
  components: {
    AnnotationCsvDialog
  }
})
export default class AnnotationList extends Vue {
  readonly store = store;
  readonly annotationStore = annotationStore;
  readonly propertyStore = propertyStore;
  readonly filterStore = filterStore;

  tableItemClass = "px-1"; // To enable dividers, use v-data-table__divider

  tableOptions: any = {};

  annotationFilteredDialog: boolean = false;

  // TODO: clean up selected after filter changes
  get selected() {
    if (!this.filtered) {
      return [];
    }
    const selectedAnnotationsIds = this.annotationStore.selectedAnnotations.map(
      annotation => annotation.id
    );
    return this.filtered.filter(annotation =>
      selectedAnnotationsIds.includes(annotation.id)
    );
  }

  set selected(selected: IAnnotation[]) {
    this.annotationStore.setSelected(selected);
  }

  get annotations() {
    return this.annotationStore.annotations;
  }

  get filtered() {
    return this.filterStore.filteredAnnotations.map(
      (annotation: IAnnotation) => {
        const item: any = {
          ...annotation,
          shape: AnnotationNames[annotation.shape]
        };
        this.properties.forEach((property: IAnnotationProperty) => {
          item[property.id] = this.getPropertyValueForAnnotation(
            annotation,
            property.id
          );
        });
        return item;
      }
    );
  }

  get propertyIds() {
    return this.propertyStore.annotationListIds.sort((a: string, b: string) =>
      a.localeCompare(b)
    );
  }

  getAnnotationIndex(id: string) {
    return this.annotationStore.annotations.findIndex(
      (annotation: IAnnotation) => annotation.id === id
    );
  }

  updateAnnotationName(name: string, id: string) {
    this.annotationStore.updateAnnotationName({ name, id });
  }

  getPropertyValueForAnnotation(annotation: IAnnotation, propertyId: string) {
    const values = this.propertyStore.propertyValues[annotation.id];
    if (!values) {
      return "-";
    }

    if (!Object.keys(values).includes(propertyId)) {
      return "-";
    }
    return values[propertyId];
  }

  get properties() {
    return this.propertyStore.properties.filter(
      (property: IAnnotationProperty) => this.propertyIds.includes(property.id)
    );
  }

  get headers() {
    return [
      {
        text: "Index",
        value: "id"
      },
      {
        text: "Shape",
        value: "shape"
      },
      {
        text: "Tags",
        value: "tags"
      },
      {
        text: "Name",
        value: "name"
      },
      ...this.properties
        .sort((a: IAnnotationProperty, b: IAnnotationProperty) =>
          a.id.localeCompare(b.id)
        )
        .map((property: IAnnotationProperty) => ({
          text: property.name,
          value: property.id
        }))
    ];
  }

  get hoveredId() {
    return this.annotationStore.hoveredAnnotationId;
  }

  get itemsPerPage() {
    return this.tableOptions.itemsPerPage;
  }

  @Watch("hoveredId")
  @Watch("itemsPerPage")
  hoveredAnnotationChanged() {
    if (this.hoveredId === null) {
      return;
    }
    // Change page
    const entryIndex = this.filtered.findIndex(
      annotation => annotation.id === this.hoveredId
    );
    if (entryIndex < 0) {
      this.annotationFilteredDialog = true;
      return;
    }
    this.tableOptions.page =
      Math.floor(entryIndex / this.itemsPerPage) + 1 || 1;
    // Get the tr element from the refs if it exists
    let annotationRef = this.$refs[this.hoveredId];
    if (annotationRef === undefined) {
      return;
    }
    if (Array.isArray(annotationRef)) {
      if (annotationRef.length <= 0) {
        return;
      }
      annotationRef = annotationRef[0];
    }
    // Scroll to the element
    (annotationRef as Element).scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  @Emit("clickedTag")
  clickedTag(tag: string) {
    return tag;
  }

  hover(annotationId: string | null) {
    this.annotationStore.setHoveredAnnotationId(annotationId);
  }

  get selectionFilterEnabled() {
    return this.filterStore.selectionFilter.enabled;
  }
  clearSelection() {
    this.filterStore.clearSelection();
  }
  filterBySelection() {
    this.filterStore.addSelectionAsFilter();
  }
}
</script>
<style>
tbody tr:hover,
tbody tr.is-hovered,
tbody tr.is-hovered:hover {
  background-color: #616161;
}

.v-text-field .v-input__control .v-input__slot {
  min-height: 0 !important;
  display: flex !important;
  align-items: center !important;
}

.v-dialog {
  width: 50%;
}

.v-input--selection-controls {
  padding: 0px;
  margin: 0px;
}

.v-input__slot {
  justify-content: center;
}

td span {
  display: block;
  text-align: center;
  margin: auto;
}
</style>
