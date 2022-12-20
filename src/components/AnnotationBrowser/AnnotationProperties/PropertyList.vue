<template>
  <v-card>
    <v-card-title>
      Annotation Properties
    </v-card-title>
    <v-card-text>
      <v-btn
        outlined
        class="ma-2"
        @click="computeUncomputed"
        :disabled="uncomputedRunning"
      >
        {{ uncomputedRunning ? "Computing uncomputed" : "Compute uncomputed" }}
        <template v-if="uncomputedRunning">
          <v-progress-circular indeterminate />
        </template>
        <template v-else>
          <v-icon right color="primary">
            mdi-reload
          </v-icon>
        </template>
      </v-btn>
      <v-container class="pa-0">
        <v-expansion-panels>
          <v-expansion-panel readonly v-if="properties.length > 0">
            <v-expansion-panel-header>
              <v-container class="ma-0 pa-0">
                <v-row class="mr-4">
                  <v-col class="px-0 d-flex justify-center" cols="1">
                    <div class="py-4 subtitle-2 d-flex">
                      In list
                    </div>
                  </v-col>
                  <v-col class="px-0 d-flex justify-center" cols="1">
                    <div class="py-4 subtitle-2 d-flex">
                      As filter
                    </div>
                  </v-col>
                  <v-col class="px-0 d-flex justify-center">
                    <div class="py-4 subtitle-2 d-flex">
                      Property
                    </div>
                  </v-col>
                  <v-col class="px-0 d-flex justify-center" cols="1">
                    <div class="py-4 subtitle-2 d-flex">
                      Compute
                    </div>
                  </v-col>
                </v-row>
              </v-container>
              <template v-slot:actions>
                <v-icon color="transparent">$expand</v-icon>
              </template>
            </v-expansion-panel-header>
          </v-expansion-panel>
          <v-expansion-panel
            v-for="(property, index) in properties"
            :key="`${property.id} ${index}`"
          >
            <v-expansion-panel-header>
              <annotation-property :property="property" />
            </v-expansion-panel-header>
            <v-expansion-panel-content>
              <v-container>
                <v-row>Image: {{ property.image }}</v-row>
                <v-row>
                  Tags ({{
                    property.tags.exclusive ? "exclusive" : "inclusive"
                  }}): {{ property.tags.tags.join(", ") }}
                </v-row>
                <v-row>Shape: {{ annotationNames[property.shape] }}</v-row>
                <v-row>
                  Worker interface:
                  <v-row
                    v-for="[name, { value }] in Object.entries(
                      property.workerInterface
                    )"
                    :key="name"
                  >
                    {{ name }}: {{ value }}
                  </v-row>
                </v-row>
              </v-container>
            </v-expansion-panel-content>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-container>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";
import propertyStore from "@/store/properties";
import filterStore from "@/store/filters";

import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import AnnotationProperty from "@/components/AnnotationBrowser/AnnotationProperties/Property.vue";

import { AnnotationNames } from "@/store/model";

@Component({
  components: {
    TagFilterEditor,
    AnnotationProperty
  }
})
export default class PropertyList extends Vue {
  readonly store = store;
  readonly propertyStore = propertyStore;
  readonly filterStore = filterStore;

  annotationNames = AnnotationNames;

  uncomputedRunning: boolean = false;

  get properties() {
    return propertyStore.properties;
  }

  computeUncomputed() {
    this.uncomputedRunning = true;
    const count = { val: 0, target: this.propertyStore.properties.length };
    for (const property of this.propertyStore.properties) {
      if (
        this.propertyStore.uncomputedAnnotationsPerProperty[property.id]
          .length > 0
      ) {
        this.propertyStore.computeProperty({
          property,
          params: property.workerInterface,
          callback: () => {
            if (++count.val >= count.target) {
              this.uncomputedRunning = false;
            }
          }
        });
      }
    }
  }
}
</script>
