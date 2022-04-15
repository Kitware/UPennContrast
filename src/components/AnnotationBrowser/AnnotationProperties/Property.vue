<template>
  <v-row>
    <!-- Enabled / Computed -->
    <!-- In list (???) -->
    <v-col class="pa-0">
      <v-checkbox
        dense
        hide-details
        :value="list"
        @click="toggleList"
      ></v-checkbox>
    </v-col>
    <!-- As filter -->
    <v-col class="pa-0">
      <v-checkbox
        dense
        hide-details
        :value="filter"
        @click="toggleFilter"
      ></v-checkbox>
    </v-col>
    <v-col class="pa-1" cols="7">
      {{ property.name }}
    </v-col>
  </v-row>
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
  private readonly property!: any;

  get filter() {
    return this.filterStore.filterIds.includes(this.property.id);
  }

  get list() {
    return this.propertyStore.annotationListIds.includes(this.property.id);
  }

  get enabled() {
    return this.property.enabled;
  }

  get computed() {
    return (
      this.enabled &&
      !this.propertyStore.isJobRunningForProperty(this.property.id)
    );
  }

  get indeterminate() {
    return this.enabled && !this.computed;
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
