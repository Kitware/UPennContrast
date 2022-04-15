<template>
  <v-expansion-panel>
    <v-expansion-panel-header>
      Annotation Properties
      <v-spacer></v-spacer>
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
    </v-expansion-panel-header>
    <v-expansion-panel-content>
      <v-container>
        <v-row class="py-4">
          <v-col v-for="header in headers" :key="header" class="pa-0">
            {{ header }}
          </v-col>
          <v-col class="pa-0" cols="7">
            Property
          </v-col>
        </v-row>
        <v-expansion-panels>
          <v-expansion-panel
            v-for="(property, index) in properties"
            :key="`${property.id} ${index}`"
          >
            <v-expansion-panel-header>
              <annotation-property :property="property"></annotation-property>
            </v-expansion-panel-header>
            <v-expansion-panel-content>
              <property-worker-menu :property="property">
              </property-worker-menu>
            </v-expansion-panel-content>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-container>
    </v-expansion-panel-content>
  </v-expansion-panel>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";
import propertyStore from "@/store/properties";
import filterStore from "@/store/filters";

import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import AnnotationProperty from "@/components/AnnotationBrowser/AnnotationProperties/Property.vue";
import PropertyCreation from "@/components/AnnotationBrowser/AnnotationProperties/PropertyCreation.vue";
import PropertyWorkerMenu from "@/components/PropertyWorkerMenu.vue";

import { IAnnotationProperty } from "@/store/model";

@Component({
  components: {
    TagFilterEditor,
    AnnotationProperty,
    PropertyCreation,
    PropertyWorkerMenu
  }
})
export default class PropertyList extends Vue {
  readonly store = store;
  readonly propertyStore = propertyStore;
  readonly filterStore = filterStore;

  propertyCreationDialogOpen = false;
  private headers = ["List", "As filter"];

  get properties() {
    return propertyStore.properties;
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
