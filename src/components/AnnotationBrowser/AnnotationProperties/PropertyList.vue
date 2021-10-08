<template>
  <v-card>
    <v-card-title class="py-1"> Property Calculator </v-card-title>
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
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
import propertyStore from "@/store/properties";

import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import AnnotationProperty from "@/components/AnnotationBrowser/AnnotationProperties/Property.vue";

@Component({
  components: {
    TagFilterEditor,
    AnnotationProperty
  }
})
export default class PropertyList extends Vue {
  readonly store = store;
  readonly propertyStore = propertyStore;

  private headers = ["Computed", "List", "As filter"];

  showMorphologic = false;
  showLayer = false;
  showRelational = false;

  get morphologicProperties() {
    return propertyStore.morphologicProperties;
  }

  get layerDependantProperties() {
    return propertyStore.layerDependantProperties;
  }
  get relationalProperties() {
    return propertyStore.relationalProperties;
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
}
</script>
