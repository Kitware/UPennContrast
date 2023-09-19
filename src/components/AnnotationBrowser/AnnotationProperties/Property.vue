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
            :value="uncomputed[property.id].length > 0 && !status.running"
            :content="uncomputed[property.id].length"
          >
            <template v-if="status.running">
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
    <v-row v-if="status.running">
      <v-progress-linear
        :indeterminate="!status.progressInfo.progress"
        :value="100 * (status.progressInfo.progress || 0)"
        class="text-progress"
      >
        <strong class="pr-4">
          {{ status.progressInfo.title }}
        </strong>
        {{ status.progressInfo.info }}
      </v-progress-linear>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import LayerSelect from "@/components/LayerSelect.vue";

import { Vue, Component, Prop } from "vue-property-decorator";
import store from "@/store";
import annotationStore from "@/store/annotation";
import propertyStore, { IPropertyStatus } from "@/store/properties";
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

  get status(): IPropertyStatus {
    return this.propertyStore.getStatus(this.property.id);
  }

  get uncomputed() {
    return this.propertyStore.uncomputedAnnotationsPerProperty;
  }

  compute() {
    if (this.status.running) {
      return;
    }
    this.propertyStore.computeProperty(this.property);
  }
}
</script>

<style lang="scss">
.text-progress {
  height: fit-content !important;
  min-height: 10px;
  padding: 4px;
}

.text-progress .v-progress-linear__content {
  position: relative;
}
</style>
