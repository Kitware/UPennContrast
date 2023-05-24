<template>
  <v-container class="ma-0 pa-0">
    <v-row class="mr-4">
      <!-- Property name -->
      <v-col class="d-flex px-2">
        <div class="d-flex align-center">
          {{ property.name }}
        </div>
      </v-col>
      <!-- Compute button -->
      <v-col class="px-0" cols="1">
        <v-btn small fab @click.native.stop :disabled="false" @click="compute">
          <v-badge
            color="red"
            :value="uncomputed[property.id].length > 0 && !running"
            :content="uncomputed[property.id].length"
          >
            <template v-if="running">
              <v-progress-circular indeterminate />
            </template>
            <template v-else>
              <v-icon color="primary">
                mdi-play
              </v-icon>
            </template>
          </v-badge>
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import LayerSelect from "@/components/LayerSelect.vue";

import { Vue, Component, Prop } from "vue-property-decorator";
import store from "@/store";
import annotationStore from "@/store/annotation";
import propertyStore from "@/store/properties";
import { IAnnotationProperty } from "@/store/model";

@Component({
  components: {
    TagFilterEditor,
    LayerSelect
  }
})
export default class AnnotationProperty extends Vue {
  readonly propertyStore = propertyStore;
  readonly annotationStore = annotationStore;
  readonly store = store;
  @Prop()
  readonly property!: IAnnotationProperty;

  running: boolean = false;
  previousRunStatus: boolean | null = null;

  get uncomputed() {
    return this.propertyStore.uncomputedAnnotationsPerProperty;
  }

  compute() {
    if (this.running) {
      return;
    }
    this.running = true;
    this.previousRunStatus = null;

    this.propertyStore.computeProperty({
      property: this.property,
      callback: success => {
        this.running = false;
        this.previousRunStatus = success;
      }
    });
  }
}
</script>
