<template>
  <v-expansion-panel>
    <v-expansion-panel-header class="py-1">
      Annotation List
      <v-spacer></v-spacer>
      <v-container style="width: auto;">
        <v-row>
          <v-col class="pa-1">
            <v-btn
              v-if="selectionFilterEnabled"
              @click.native.stop="clearSelection"
              block
            >
              Clear selection filter
            </v-btn>
            <v-btn v-else @click.native.stop="filterBySelection" block>
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
        :items="filteredItems"
        :headers="headers"
        v-model="selected"
        item-key="id"
        show-select
        :page="page"
        @update:items-per-page="itemsPerPage = $event"
        @update:group-by="groupBy = $event"
        ref="dataTable"
      >
        <template v-slot:body="{ items }">
          <tbody>
            <tr
              v-for="item in items"
              :key="item.id"
              @mouseover="hover(item.id)"
              @mouseleave="hover(null)"
              @click="goToAnnotationIdLocation(item.id)"
              title="Go to annotation location"
              :class="item.id === hoveredId ? 'is-hovered' : ''"
              :ref="item.id"
            >
              <td :class="tableItemClass">
                <v-checkbox
                  hide-details
                  multiple
                  :value="item"
                  v-model="selected"
                  @click.capture.stop
                  title
                ></v-checkbox>
              </td>
              <td :class="tableItemClass">
                <span>{{ annotationIdToIndex.get(item.id) }}</span>
              </td>
              <td :class="tableItemClass">
                <span>
                  {{ item.shapeName }}
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
              <td>
                {{ item.location.XY + 1 }}
              </td>
              <td>
                {{ item.location.Z + 1 }}
              </td>
              <td>
                {{ item.location.Time + 1 }}
              </td>
              <td :class="tableItemClass">
                <v-text-field
                  hide-details
                  :value="item.name || ''"
                  dense
                  flat
                  outlined
                  @change="updateAnnotationName($event, item.id)"
                  @click.capture.stop
                  title
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
import AnnotationExport from "@/components/AnnotationBrowser/AnnotationExport.vue";
import AnnotationImport from "@/components/AnnotationBrowser/AnnotationImport.vue";

interface IAnnotationListItem extends IAnnotation {
  shapeName: string;
  [propertyId: string]: any;
}

@Component({
  components: {
    AnnotationCsvDialog,
    AnnotationExport,
    AnnotationImport
  }
})
export default class AnnotationList extends Vue {
  readonly store = store;
  readonly annotationStore = annotationStore;
  readonly propertyStore = propertyStore;
  readonly filterStore = filterStore;

  tableItemClass = "px-1"; // To enable dividers, use v-data-table__divider

  annotationFilteredDialog: boolean = false;

  annotationIdToIndex: Map<string, number> = new Map();

  // These are "from" or "to" v-data-table
  page: number = 0; // one-way binding :page
  itemsPerPage: number = 10; // one-way binding @update:items-per-page
  groupBy: string | string[] = []; // one-way binding @update:group-by

  get selected() {
    return this.annotationStore.selectedAnnotations.filter(annotation =>
      this.filteredAnnotationIdToIdx.has(annotation.id)
    );
  }

  set selected(selected: IAnnotation[]) {
    this.annotationStore.setSelected(selected);
  }

  get filteredAnnotationIdToIdx() {
    return this.filterStore.filteredAnnotationIdToIdx;
  }

  get filteredAnnotations() {
    return this.filterStore.filteredAnnotations;
  }

  get filteredItems() {
    return this.filterStore.filteredAnnotations.map(this.annotationToItem);
  }

  annotationToItem(annotation: IAnnotation) {
    const item: IAnnotationListItem = {
      ...annotation,
      shapeName: AnnotationNames[annotation.shape]
    };
    this.properties.forEach((property: IAnnotationProperty) => {
      item[property.id] = this.getPropertyValueForAnnotationId(
        annotation.id,
        property.id
      );
    });
    return item;
  }

  get propertyIds() {
    return this.propertyStore.annotationListIds.sort((a: string, b: string) =>
      a.localeCompare(b)
    );
  }

  @Watch("annotationStore.annotationIdToIdx")
  updateAnnotationIndices() {
    this.annotationIdToIndex = this.annotationStore.annotationIdToIdx;
  }

  updateAnnotationName(name: string, id: string) {
    this.annotationStore.updateAnnotationName({ name, id });
  }

  getPropertyValueForAnnotationId(annotationId: string, propertyId: string) {
    const values = this.propertyStore.propertyValues[annotationId];
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
        text: "XY",
        value: "xy"
      },
      {
        text: "Z",
        value: "z"
      },
      {
        text: "Time",
        value: "time"
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

  goToAnnotationIdLocation(annotationId: string) {
    const annotation = this.annotationStore.getAnnotationFromId(annotationId);
    if (!annotation) {
      return;
    }
    this.store.setXY(annotation.location.XY);
    this.store.setZ(annotation.location.Z);
    this.store.setTime(annotation.location.Time);
  }

  get hoveredId() {
    return this.annotationStore.hoveredAnnotationId;
  }

  get vDataTable() {
    const vDataTableParent = this.$refs.dataTable as any;
    if (!vDataTableParent) {
      return null;
    }
    return vDataTableParent.$children?.[0] || null;
  }

  get dataTableItems() {
    const vDataTable = this.vDataTable;
    if (!vDataTable) {
      return [];
    }
    let tableItems = vDataTable.filteredItems.slice();
    if (
      (!vDataTable.disableSort || this.groupBy?.length) &&
      vDataTable.serverItemsLength <= 0
    ) {
      tableItems = vDataTable.sortItems(tableItems);
    }
    return tableItems;
  }

  get getPageFromItemId() {
    return (itemId: string) => {
      const entryIndex = this.dataTableItems.findIndex(
        ({ id }: any) => id === itemId
      );
      if (entryIndex <= 0) {
        return 0;
      }
      const itemsPerPage = this.itemsPerPage;
      if (itemsPerPage <= 0) {
        return 0;
      } else {
        return (Math.floor(entryIndex / itemsPerPage) || 0) + 1;
      }
    };
  }

  @Watch("hoveredId")
  @Watch("itemsPerPage")
  hoveredAnnotationChanged() {
    if (this.hoveredId === null) {
      return;
    }
    // Change page
    this.page = this.getPageFromItemId(this.hoveredId);
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
  cursor: pointer;
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
