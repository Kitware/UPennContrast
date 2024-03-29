<template>
  <v-expansion-panel>
    <v-expansion-panel-header class="py-1">
      Annotation List
      <v-spacer />
      <v-container style="width: auto">
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
                <v-card-title> Add tags to selected annotations </v-card-title>
                <tag-picker class="ma-4 pa-4" v-model="tagsToAdd"></tag-picker>
                <v-divider></v-divider>
                <v-card-actions>
                  <v-spacer></v-spacer>
                  <v-btn color="warning" @click="tagsToAdd = []"> Clear </v-btn>
                  <v-btn color="primary" @click="tagSelected"> Submit </v-btn>
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
      <v-row>
        <v-col cols="12" md="6">
          <v-select
            v-model="selectedColumns"
            :items="columnOptions"
            attach
            chips
            label="Select columns"
            multiple
            small-chips
          ></v-select>
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="localIdFilter"
            label="Filter by annotation ID"
            single-line
            clearable
          ></v-text-field>
        </v-col>
      </v-row>
      <v-data-table
        :items="filteredItems"
        :headers="headers"
        show-select
        item-key="annotation.id"
        v-model="selectedItems"
        :page="page"
        :footer-props="{
          'items-per-page-options': [10, 50, 200],
        }"
        @update:items-per-page="itemsPerPage = $event"
        @update:group-by="groupBy = $event"
        ref="dataTable"
      >
        <template v-slot:header.data-table-select>
          <v-simple-checkbox
            :value="selectAllValue"
            :indeterminate="selectAllIndeterminate"
            @click="selectAllCallback"
          />
        </template>
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
                  title
                  :input-value="item.isSelected"
                  @click.stop="() => toggleAnnotationSelection(item.annotation)"
                />
              </td>
              <td :class="tableItemClass" v-if="selectedColumns.includes('id')">
                <span>{{ item.annotation.id }}</span>
              </td>
              <td
                :class="tableItemClass"
                v-if="selectedColumns.includes('index')"
              >
                <span>{{ annotationIdToIndex[item.annotation.id] }}</span>
              </td>
              <td
                :class="tableItemClass"
                v-if="selectedColumns.includes('shape')"
              >
                <span>{{ item.shapeName }}</span>
              </td>
              <td
                :class="tableItemClass"
                v-if="selectedColumns.includes('tags')"
              >
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
              <td v-if="selectedColumns.includes('xy')">
                {{ item.annotation.location.XY + 1 }}
              </td>
              <td v-if="selectedColumns.includes('z')">
                {{ item.annotation.location.Z + 1 }}
              </td>
              <td v-if="selectedColumns.includes('time')">
                {{ item.annotation.location.Time + 1 }}
              </td>
              <td
                :class="tableItemClass"
                v-if="selectedColumns.includes('name')"
              >
                <v-text-field
                  hide-details
                  :value="item.annotation.name || ''"
                  dense
                  flat
                  outlined
                  @change="updateAnnotationName($event, item.annotation.id)"
                  @click.capture.stop
                  title
                ></v-text-field>
              </td>
              <td
                v-for="(propertyPath, idx) in displayedPropertyPaths"
                :key="item.annotation.id + ' property ' + idx"
                :class="tableItemClass"
              >
                <span>{{
                  getStringFromPropertiesAndPath(item.properties, propertyPath)
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
import { getStringFromPropertiesAndPath } from "@/utils/paths";

import TagPicker from "@/components/TagPicker.vue";

import {
  AnnotationNames,
  IAnnotation,
  IAnnotationPropertyValues,
} from "@/store/model";

interface IAnnotationListItem {
  annotation: IAnnotation;
  shapeName: string;
  isSelected: boolean;
  properties: IAnnotationPropertyValues[0];
}

@Component({
  components: { TagPicker },
})
export default class AnnotationList extends Vue {
  readonly store = store;
  readonly annotationStore = annotationStore;
  readonly propertyStore = propertyStore;
  readonly filterStore = filterStore;
  readonly getStringFromPropertiesAndPath = getStringFromPropertiesAndPath;

  columnOptions = [
    { text: "Annotation ID", value: "id" },
    { text: "Index", value: "index" },
    { text: "Shape", value: "shape" },
    { text: "Tags", value: "tags" },
    { text: "XY", value: "xy" },
    { text: "Z", value: "z" },
    { text: "Time", value: "time" },
    { text: "Name", value: "name" },
  ];

  selectedColumns = ["id", "index", "shape", "tags", "xy", "z", "time", "name"];

  tableItemClass = "px-1"; // To enable dividers, use v-data-table__divider

  annotationFilteredDialog: boolean = false;
  localIdFilter?: string = "";

  // These are "from" or "to" v-data-table
  page: number = 0; // one-way binding :page
  itemsPerPage: number = 10; // one-way binding @update:items-per-page
  groupBy: string | string[] = []; // one-way binding @update:group-by

  get selected() {
    return this.annotationStore.selectedAnnotations.filter((annotation) =>
      this.filteredAnnotationIdToIdx.has(annotation.id),
    );
  }

  set selected(selected: IAnnotation[]) {
    this.annotationStore.setSelected(selected);
  }

  get selectedItems() {
    return this.filteredItems.filter((item) => item.isSelected);
  }

  set selectedItems(items) {
    this.selected = items.map((item) => item.annotation);
  }

  toggleAnnotationSelection(annotation: IAnnotation) {
    this.annotationStore.toggleSelected([annotation]);
  }

  get filteredAnnotationIdToIdx() {
    return this.filterStore.filteredAnnotationIdToIdx;
  }

  get listedAnnotations() {
    let annotations = this.filterStore.filteredAnnotations;
    const idFilter = this.localIdFilter?.trim();
    if (idFilter) {
      annotations = annotations.filter((annotation) =>
        annotation.id.includes(idFilter),
      );
    }
    return annotations;
  }

  get filteredItems() {
    return this.listedAnnotations.map(this.annotationToItem);
  }

  get annotationToItem() {
    return (annotation: IAnnotation) => ({
      annotation,
      shapeName: AnnotationNames[annotation.shape],
      isSelected: this.annotationStore.isAnnotationSelected(annotation.id),
      properties: this.propertyStore.propertyValues[annotation.id] || {},
    });
  }

  get displayedPropertyPaths() {
    return this.propertyStore.displayedPropertyPaths;
  }

  get annotationIdToIndex() {
    return this.annotationStore.annotationIdToIdx;
  }

  updateAnnotationName(name: string, id: string) {
    this.annotationStore.updateAnnotationName({ name, id });
  }

  get getPropertyValueForAnnotationId() {
    return (annotationId: string, propertyId: string) => {
      const values = this.propertyStore.propertyValues[annotationId];
      if (!values || !Object.keys(values).includes(propertyId)) {
        return "-";
      }
      return values[propertyId];
    };
  }

  get selectAllIndeterminate() {
    const nSelected = this.selectedItems.length;
    return nSelected > 0 && nSelected < this.filteredItems.length;
  }

  get selectAllValue() {
    return this.selectedItems.length === this.filteredItems.length;
  }

  selectAllCallback() {
    if (this.selectAllValue) {
      this.selectedItems = [];
    } else {
      this.selectedItems = this.filteredItems;
    }
  }

  get headers() {
    const allHeaders = [
      { text: "Annotation ID", value: "id" },
      { text: "Index", value: "index" },
      { text: "Shape", value: "shape" },
      { text: "Tags", value: "tags" },
      { text: "XY", value: "xy" },
      { text: "Z", value: "z" },
      { text: "Time", value: "time" },
      { text: "Name", value: "name" },
      // Add more headers if necessary
    ];

    // Filter headers based on selectedColumns while preserving the order defined above
    const filteredHeaders = allHeaders.filter((header) =>
      this.selectedColumns.includes(header.value),
    );

    // Return the filtered headers with propertyHeaders appended at the end
    return [...filteredHeaders, ...this.propertyHeaders];
  }

  get propertyHeaders() {
    const propertyHeaders = [];
    // Order is important, it should be the same as in the <td v-for="x in y"> above
    for (const path of this.displayedPropertyPaths) {
      const fullName = this.propertyStore.getFullNameFromPath(path);
      propertyHeaders.push({
        text: fullName,
        value: "", // Not optional but not used because the slot "body" is used
      });
    }
    return propertyHeaders;
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

  get dataTableItems(): IAnnotationListItem[] {
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
        ({ annotation }) => annotation.id === itemId,
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
      block: "nearest",
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
