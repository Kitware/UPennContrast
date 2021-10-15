<template>
  <v-card>
    <v-card-title class="py-1">
      Annotation List
    </v-card-title>
    <v-card-text>
      <v-data-table
        :items="filtered"
        :headers="headers"
        item-key="id"
        v-model="selected"
        show-select
      >
        <template v-slot:body="{ items }">
          <tbody>
            <tr
              v-for="item in items"
              :key="item.id"
              @mouseover="hover(item.id)"
              @mouseleave="hover(null)"
              :class="item.id === hoveredId ? 'is-hovered' : ''"
            >
              <td>
                <v-checkbox
                  multiple
                  v-model="selected"
                  :value="item"
                  hide-details
                ></v-checkbox>
              </td>
              <td>
                <v-checkbox
                  :value="isAnnotationActive(item)"
                  @click="toggleActive(item)"
                ></v-checkbox>
              </td>
              <td>
                <span>{{ annotations.indexOf(item) }}</span>
              </td>
              <td>
                {{ item.shape }}
              </td>
              <td>
                <v-chip
                  v-for="tag in item.tags"
                  :key="tag"
                  x-small
                  @click="clickedTag(tag)"
                  >{{ tag }}</v-chip
                >
              </td>
              <td>
                <v-text-field
                  hide-details
                  :value="item.name || ''"
                  dense
                  flat
                  @change="updateAnnotationName($event, item.id)"
                >
                </v-text-field>
              </td>
              <td v-for="propertyId in propertyIds" :key="propertyId">
                {{ getPropertyValueForAnnotation(item, propertyId) }}
              </td>
            </tr>
          </tbody>
        </template>
      </v-data-table>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch, Emit } from "vue-property-decorator";
import store from "@/store";
import annotationStore from "@/store/annotation";
import propertyStore from "@/store/properties";
import filterStore from "@/store/filters";

import {
  IAnnotation,
  IAnnotationProperty,
  ILayerDependentAnnotationProperty,
  IPropertyAnnotationFilter
} from "@/store/model";

@Component({
  components: {}
})
export default class AnnotationList extends Vue {
  readonly store = store;
  readonly annotationStore = annotationStore;
  readonly propertyStore = propertyStore;
  readonly filterStore = filterStore;

  // TODO: clean up selected after filter changes
  get selected() {
    return this.annotationStore.selectedAnnotations;
  }

  set selected(selected: IAnnotation[]) {
    this.annotationStore.setSelected(selected);
  }

  get annotations() {
    return this.annotationStore.annotations;
  }

  get filtered() {
    return this.filterStore.filteredAnnotations;
  }

  get propertyIds() {
    return this.propertyStore.annotationListIds;
  }

  updateAnnotationName(name: string, id: string) {
    this.annotationStore.updateAnnotationName({ name, id });
  }

  isAnnotationActive(annotation: IAnnotation) {
    return this.annotationStore.activeAnnotationIds.includes(annotation.id);
  }

  toggleActive(annotation: IAnnotation) {
    // TODO: have an "activeAnnotation" array instead ?
    this.annotationStore.toggleActiveAnnotation(annotation.id);
  }

  getPropertyValueForAnnotation(annotation: IAnnotation, propertyId: string) {
    const { annotationIds, values } = this.propertyStore.computedValues[
      propertyId
    ];
    if (!annotationIds || !values) {
      return "-";
    }
    const index = annotationIds.indexOf(annotation.id);
    if (index === -1) {
      return "-";
    }
    return values[index];
  }

  get properties() {
    return {};
  }

  get headers() {
    return [
      {
        text: "Active",
        value: "active"
      },
      {
        text: "Annotation Index",
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
      ...this.properties.map((property: IAnnotationProperty) => ({
        text:
          (property as ILayerDependentAnnotationProperty).customName ||
          property.name,
        value: property.id
      }))
    ];
  }

  get hoveredId() {
    return this.annotationStore.hoveredAnnotationId;
  }

  @Emit("clickedTag")
  clickedTag(tag: string) {
    return tag;
  }

  hover(annotationId: string | null) {
    this.annotationStore.setHoveredAnnoationId(annotationId);
  }
}
</script>
<style>
tbody tr:hover,
tbody tr.is-hovered,
tbody tr.is-hovered:hover {
  background-color: #616161;
}
</style>
