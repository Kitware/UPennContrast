<template>
  <v-expansion-panel>
    <v-expansion-panel-header>
      Annotation Properties
    </v-expansion-panel-header>
    <v-expansion-panel-content>
      <v-container class="pa-0">
        <v-expansion-panels>
          <v-expansion-panel
            v-for="(property, index) in properties"
            :key="`${property.id} ${index}`"
          >
            <v-expansion-panel-header>
              <annotation-property
                :property="property"
                :enableLabels="index === 0"
              />
            </v-expansion-panel-header>
            <v-expansion-panel-content>
              <property-worker-menu :property="property" />
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
import PropertyWorkerMenu from "@/components/PropertyWorkerMenu.vue";

@Component({
  components: {
    TagFilterEditor,
    AnnotationProperty,
    PropertyWorkerMenu
  }
})
export default class PropertyList extends Vue {
  readonly store = store;
  readonly propertyStore = propertyStore;
  readonly filterStore = filterStore;

  get properties() {
    return propertyStore.properties;
  }
}
</script>
