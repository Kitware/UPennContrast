<template>
  <v-expansion-panel>
    <v-expansion-panel-header class="py-1">
      Annotation List
      <v-spacer />
      <v-container style="width: auto;">
        <v-row>
          <v-col class="pa-1">
            <v-btn block @click.stop="deleteSelected">Delete Selected</v-btn>
          </v-col>
          <v-col class="pa-1">
            <v-dialog v-model="tagSelectedDialog" width="50%">
              <template v-slot:activator="{ on, attrs }">
                <v-btn block v-bind="attrs" v-on="on" @click.stop>
                  Tag Selected
                </v-btn>
              </template>
              <v-card>
                <v-card-title>
                  Add tags to selected annotations
                </v-card-title>
                <tag-picker class="ma-4 pa-4" v-model="tagsToAdd"></tag-picker>
                <v-divider></v-divider>
                <v-card-actions>
                  <v-spacer></v-spacer>
                  <v-btn color="warning" @click="tagsToAdd = []">
                    Clear
                  </v-btn>
                  <v-btn color="primary" @click="tagSelected">
                    Submit
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
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
              :key="item.annotation.id"
              @mouseover="hover(item.annotation.id)"
              @mouseleave="hover(null)"
              @click="goToAnnotationIdLocation(item.annotation.id)"
              title="Go to annotation location"
              :class="item.annotation.id === hoveredId ? 'is-hovered' : ''"
              :ref="item.annotation.id"
            >
              <td :class="tableItemClass">
                <v-checkbox
                  hide-details
                  multiple
                  title
                  @click.stop="() => toggleAnnotationSelection(item.annotation)"
                />
              </td>
              <td :class="tableItemClass">
                <span>{{ annotationIdToIndex.get(item.annotation.id) }}</span>
              </td>
              <td :class="tableItemClass">
                <span>
                  {{ item.shapeName }}
                </span>
              </td>
              <td :class="tableItemClass">
                <span>
                  <v-chip
                    v-for="tag in item.annotation.tags"
                    :key="tag"
                    x-small
                    @click="clickedTag(tag)"
                    >{{ tag }}</v-chip
                  >
                </span>
              </td>
              <td>
                {{ item.annotation.location.XY + 1 }}
              </td>
              <td>
                {{ item.annotation.location.Z + 1 }}
              </td>
              <td>
                {{ item.annotation.location.Time + 1 }}
              </td>
              <td :class="tableItemClass">
                <v-text-field
                  hide-details
                  :value="item.annotation.name || ''"
                  dense
                  flat
                  outlined
                  @change="updateAnnotationName($event, item.annotation.id)"
                  @click.capture.stop
                  title
                >
                </v-text-field>
              </td>
              <td
                v-for="propertyId in showedPropertyIds"
                :key="propertyId"
                :class="tableItemClass"
              >
                <span>{{
                  typeof item[propertyId] === "number"
                    ? Math.round(item[propertyId] * 100) / 100
                    : item[propertyId]
                }}</span>
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

import TagPicker from "@/components/TagPicker.vue";

import {
  AnnotationNames,
  IAnnotation,
  IAnnotationProperty
} from "@/store/model";

interface IAnnotationListItem {
  annotation: IAnnotation;
  shapeName: string;
  [propertyId: string]: any;
}

@Component({
  components: { TagPicker }
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

  toggleAnnotationSelection(annotation: IAnnotation) {
    this.annotationStore.toggleSelected([annotation]);
  }

  get filteredAnnotationIdToIdx() {
    return this.filterStore.filteredAnnotationIdToIdx;
  }

  get filteredItems() {
    return this.filterStore.filteredAnnotations.map(this.annotationToItem);
  }

  annotationToItem(annotation: IAnnotation) {
    const item: IAnnotationListItem = {
      annotation,
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

  get showedPropertyIds() {
    return this.propertyStore.annotationListIds;
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
      (property: IAnnotationProperty) =>
        this.showedPropertyIds.includes(property.id)
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

  tagSelectedDialog: boolean = false;
  tagsToAdd: string[] = [];
  tagSelected() {
    this.annotationStore.tagSelectedAnnotations(this.tagsToAdd);
    this.tagSelectedDialog = false;
    this.tagsToAdd = [];
  }

  deleteSelected() {
    this.annotationStore.deleteSelectedAnnotations();
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
