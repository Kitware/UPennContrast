<template>
  <v-expansion-panel>
    <v-expansion-panel-header>
      Annotation Controls
    </v-expansion-panel-header>
    <v-expansion-panel-content>
      <v-list dense class="py-0">
        <v-list-item>
          <v-checkbox
            hide-details
            v-model="drawAnnotations"
            dense
            label="Show Annotations"
          ></v-checkbox>
        </v-list-item>
        <v-list-item v-if="drawAnnotations">
          <v-list dense class="py-0">
            <v-list-item>
              <v-switch
                hide-details
                dense
                v-model="filteredDraw"
                label="Filtered"
              ></v-switch>
            </v-list-item>
            <v-list-item>
              <v-checkbox
                hide-details
                dense
                v-model="drawConnections"
                label="Show Connections"
              ></v-checkbox>
            </v-list-item>
            <v-list-item>
              <v-checkbox
                hide-details
                dense
                v-model="showTooltips"
                label="Show Tooltips (hotkey T)"
              ></v-checkbox>
            </v-list-item>
            <v-list-item v-if="showTooltips">
              <v-list dense class="py-0">
                <v-list-item>
                  <v-switch
                    hide-details
                    dense
                    v-model="filteredAnnotationTooltips"
                    label="Filtered"
                  ></v-switch>
                </v-list-item>
              </v-list>
            </v-list-item>
          </v-list>
        </v-list-item>
        <v-list-item>
          <v-select
            v-model="annotationSelectionType"
            :items="annotationsSelectionTypeItems"
            item-text="text"
            item-value="value"
            label="Annotation Selection Type"
          ></v-select>
        </v-list-item>
      </v-list>
    </v-expansion-panel-content>
  </v-expansion-panel>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";

import {
  AnnotationSelectionTypes,
  AnnotationSelectionTypesNames,
  AnnotationSelectionTypesTooltips
} from "../../store/model";

@Component({
  components: {}
})
export default class AnnotationToggles extends Vue {
  readonly store = store;

  annotationsSelectionTypeItems: {
    value: string;
    text: string;
  }[] = [
    {
      text: AnnotationSelectionTypesNames[AnnotationSelectionTypes.ADD],
      value: AnnotationSelectionTypes.ADD
    },
    {
      text: AnnotationSelectionTypesNames[AnnotationSelectionTypes.TOGGLE],
      value: AnnotationSelectionTypes.TOGGLE
    },
    {
      text: AnnotationSelectionTypesNames[AnnotationSelectionTypes.REMOVE],
      value: AnnotationSelectionTypes.REMOVE
    }
  ];

  get annotationSelectionType() {
    return this.store.annotationSelectionType;
  }

  set annotationSelectionType(value) {
    this.store.setAnnotationSelectionType(value);
  }

  get drawAnnotations() {
    return this.store.drawAnnotations;
  }

  set drawAnnotations(value: boolean) {
    this.store.setDrawAnnotations(value);
  }

  get showTooltips() {
    return this.store.showTooltips;
  }

  set showTooltips(value: boolean) {
    this.store.setShowTooltips(value);
  }

  get filteredAnnotationTooltips() {
    return this.store.filteredAnnotationTooltips;
  }

  set filteredAnnotationTooltips(value: boolean) {
    this.store.setFilteredAnnotationTooltips(value);
  }

  get filteredDraw() {
    return this.store.filteredDraw;
  }

  set filteredDraw(value: boolean) {
    this.store.setFilteredDraw(value);
  }

  get drawConnections() {
    return this.store.drawAnnotationConnections;
  }

  set drawConnections(value: boolean) {
    this.store.setDrawAnnotationConnections(value);
  }
}
</script>
