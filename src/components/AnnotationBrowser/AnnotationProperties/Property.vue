<template>
  <v-container class="ma-0 pa-0">
    <v-row class="mr-4">
      <!-- In list (???) -->
      <v-col class="px-0" cols="1">
        <div>
          <v-checkbox
            dense
            hide-details
            :value="list"
            @click.stop="toggleList"
            class="ma-0"
          />
        </div>
      </v-col>
      <!-- As filter -->
      <v-col class="px-0" cols="1">
        <div>
          <v-checkbox
            dense
            hide-details
            :value="filter"
            @click.stop="toggleFilter"
            class="ma-0"
          />
        </div>
      </v-col>
      <!-- Property name -->
      <v-col class="px-2">
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
                mdi-reload
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
import filterStore from "@/store/filters";
import { IAnnotationProperty } from "@/store/model";
import { property } from "lodash";

@Component({
  components: {
    TagFilterEditor,
    LayerSelect
  }
})
export default class AnnotationProperty extends Vue {
  readonly propertyStore = propertyStore;
  readonly annotationStore = annotationStore;
  readonly filterStore = filterStore;
  readonly store = store;
  @Prop()
  readonly property!: IAnnotationProperty;

  running: boolean = false;
  previousRunStatus: boolean | null = null;

  get filter() {
    return this.filterStore.filterIds.includes(this.property.id);
  }

  get list() {
    return this.propertyStore.annotationListIds.includes(this.property.id);
  }

  get uncomputed() {
    return this.propertyStore.uncomputedAnnotationsPerProperty;
  }

  toggleFilter() {
    if (this.filter) {
      this.filterStore.removeFilterId(this.property.id);
    } else {
      this.filterStore.addFilterId(this.property.id);
    }
  }

  toggleList() {
    if (this.list) {
      this.propertyStore.removeAnnotationListId(this.property.id);
    } else {
      this.propertyStore.addAnnotationListId(this.property.id);
    }
  }

  compute() {
    if (this.running) {
      return;
    }
    this.running = true;
    this.previousRunStatus = null;

    this.propertyStore.computeProperty({
      property: this.property,
      params: this.property.workerInterface,
      callback: success => {
        this.running = false;
        this.previousRunStatus = success;
      }
    });
  }
}
</script>
