<template>
  <v-card>
    <v-card-title class="py-1">
      Property Calculator
      <v-btn icon @click="refreshPropertyValues"
        ><v-icon>mdi-refresh</v-icon></v-btn
      >
      <v-dialog v-model="propertyCreationDialogOpen" width="unset">
        <template v-slot:activator="{ on: dialog }">
          <v-tooltip top>
            <template v-slot:activator="{ on: tooltip }">
              <v-btn icon v-on="{ ...dialog, ...tooltip }">
                <v-icon>
                  {{ "mdi-plus" }}
                </v-icon>
              </v-btn>
            </template>
            <span>Create new property</span>
          </v-tooltip>
        </template>
        <property-creation
          @done="propertyCreationDialogOpen = false"
          :open="propertyCreationDialogOpen"
        />
      </v-dialog>
    </v-card-title>
    <v-card-subtitle class="py-1"
      >Layer dependent properties
      <v-btn icon @click="showLayer = !showLayer">
        <v-icon>{{ showLayer ? "mdi-chevron-up" : "mdi-chevron-down" }}</v-icon>
      </v-btn></v-card-subtitle
    >
    <v-expand-transition>
      <div v-show="showLayer">
        <v-divider></v-divider>
        <v-card-text>
          <v-container>
            <v-row class="pa-1">
              <v-col v-for="header in headers" :key="header" class="pa-0">
                {{ header }}
              </v-col>
              <v-col class="pa-0" cols="7">
                Property
              </v-col>
            </v-row>
            <annotation-property
              v-for="property in layerDependantProperties"
              :key="property.id"
              :property="property"
            ></annotation-property>
          </v-container>
        </v-card-text></div
    ></v-expand-transition>

    <v-card-subtitle class="py-1">
      <span>Morphology Properties</span
      ><v-btn icon @click="showMorphologic = !showMorphologic">
        <v-icon>{{
          showMorphologic ? "mdi-chevron-up" : "mdi-chevron-down"
        }}</v-icon>
      </v-btn>
    </v-card-subtitle>
    <v-expand-transition>
      <div v-show="showMorphologic">
        <v-divider></v-divider>
        <v-card-text>
          <v-container>
            <v-row class="pa-1">
              <v-col v-for="header in headers" :key="header" class="pa-0">
                {{ header }}
              </v-col>
              <v-col class="pa-0" cols="7">
                Property
              </v-col>
            </v-row>
            <annotation-property
              v-for="property in morphologicProperties"
              :key="property.id"
              :property="property"
            ></annotation-property>
          </v-container>
        </v-card-text></div
    ></v-expand-transition>

    <v-card-subtitle class="py-1">
      <span>Relational Properties</span>
      <v-btn icon @click="showRelational = !showRelational">
        <v-icon>{{
          showRelational ? "mdi-chevron-up" : "mdi-chevron-down"
        }}</v-icon>
      </v-btn>
    </v-card-subtitle>
    <v-expand-transition>
      <div v-show="showRelational">
        <v-divider></v-divider>
        <v-card-text>
          <v-container>
            <v-row>
              <v-col v-for="header in headers" :key="header" class="pa-1">
                {{ header }}
              </v-col>
              <v-col class="pa-2" cols="7">
                Property
              </v-col>
            </v-row>
            <annotation-property
              v-for="property in relationalProperties"
              :key="property.id"
              :property="property"
            ></annotation-property>
          </v-container>
        </v-card-text></div
    ></v-expand-transition>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";
import propertyStore from "@/store/properties";
import filterStore from "@/store/filters";

import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import AnnotationProperty from "@/components/AnnotationBrowser/AnnotationProperties/Property.vue";
import PropertyCreation from "@/components/AnnotationBrowser/AnnotationProperties/PropertyCreation.vue";

import { IAnnotationProperty } from "@/store/model";

@Component({
  components: {
    TagFilterEditor,
    AnnotationProperty,
    PropertyCreation
  }
})
export default class PropertyList extends Vue {
  readonly store = store;
  readonly propertyStore = propertyStore;
  readonly filterStore = filterStore;

  propertyCreationDialogOpen = false;
  private headers = ["Computed", "List", "As filter"];

  showMorphologic = false;
  showLayer = false;
  showRelational = false;

  get properties() {
    return propertyStore.properties;
  }

  get morphologicProperties() {
    return this.properties.filter(
      (property: IAnnotationProperty) => property.propertyType === "morphology"
    );
  }

  get layerDependantProperties() {
    return this.properties.filter(
      (property: IAnnotationProperty) => property.propertyType === "layer"
    );
  }
  get relationalProperties() {
    return this.properties.filter(
      (property: IAnnotationProperty) => property.propertyType === "relational"
    );
  }

  get layers() {
    return this.store.configuration?.view.layers || [];
  }

  get layerItems() {
    return this.layers.map((layer, index) => ({
      label: layer.name,
      value: index
    }));
  }
  // TODO: put this somewhere else/automatize
  refreshPropertyValues() {
    this.propertyStore.fetchProperties();
    this.propertyStore.fetchPropertyValues(); // TODO: not here
    this.filterStore.updateHistograms();
  }
}
</script>
