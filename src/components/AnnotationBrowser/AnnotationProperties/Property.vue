<template>
  <v-container class="ma-0 pa-0">
    <v-row class="mr-4">
      <!-- In list (???) -->
      <v-col class="pa-0">
        <div v-if="enableLabels" class="py-4 subtitle-2 label">
          In list
        </div>
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
      <v-col class="pa-0">
        <div v-if="enableLabels" class="py-4 subtitle-2 label">
          As filter
        </div>
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
      <v-col class="pa-0" cols="7">
        <div v-if="enableLabels" class="py-4 subtitle-2 label">
          Property
        </div>
        <div class="d-flex align-center">
          {{ property.name }}
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import LayerSelect from "@/components/LayerSelect.vue";

import { Vue, Component, Prop } from "vue-property-decorator";
import store from "@/store";
import propertyStore from "@/store/properties";
import filterStore from "@/store/filters";

@Component({
  components: {
    TagFilterEditor,
    LayerSelect
  }
})
export default class AnnotationProperty extends Vue {
  readonly propertyStore = propertyStore;
  readonly filterStore = filterStore;
  readonly store = store;
  @Prop()
  readonly property!: any;
  @Prop()
  readonly enableLabels!: boolean;

  get filter() {
    return this.filterStore.filterIds.includes(this.property.id);
  }

  get list() {
    return this.propertyStore.annotationListIds.includes(this.property.id);
  }

  get enabled() {
    return this.property.enabled;
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
}
</script>

<style lang="scss" scoped>
.label {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
