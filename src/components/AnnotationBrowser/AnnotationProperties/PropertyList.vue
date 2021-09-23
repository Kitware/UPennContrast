<template>
  <v-card>
    <v-card-title>
      Property Calculator
    </v-card-title>
    <v-card-subtitle class="pa-2">Layer dependent properties</v-card-subtitle>
    <v-card-text>
      <v-container>
        <v-row class="pa-1">
          <v-col v-for="header in headers" :key="header" class="pa-0">
            {{ header }}
          </v-col>
          <v-col class="pa-0" cols="8">
            Property
          </v-col>
        </v-row>
        <annotation-property
          v-for="property in layerDependantProperties"
          :key="property.id"
          :property="property"
        ></annotation-property>
      </v-container>
    </v-card-text>
    <v-card-subtitle class="pa-2">
      <span>Morphology Properties</span>
    </v-card-subtitle>
    <v-card-text>
      <v-container>
        <v-row class="pa-1">
          <v-col v-for="header in headers" :key="header" class="pa-0">
            {{ header }}
          </v-col>
          <v-col class="pa-0" cols="8">
            Property
          </v-col>
        </v-row>
        <annotation-property
          v-for="property in morphologicProperties"
          :key="property.id"
          :property="property"
        ></annotation-property>
      </v-container>
    </v-card-text>
    <v-card-subtitle class="pa-2">
      <span>Relational Properties</span>
    </v-card-subtitle>
    <v-card-text>
      <v-container>
        <v-row>
          <v-col v-for="header in headers" :key="header" class="pa-1">
            {{ header }}
          </v-col>
          <v-col class="pa-2" cols="8">
            Property
          </v-col>
        </v-row>
        <annotation-property
          v-for="property in relationalProperties"
          :key="property.id"
          :property="property"
        ></annotation-property>
      </v-container>
    </v-card-text>
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
