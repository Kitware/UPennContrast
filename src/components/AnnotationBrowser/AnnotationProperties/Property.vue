<template>
  <v-row>
    <!-- Enabled / Computed -->
    <v-col class="pa-0">
      <v-checkbox
        dense
        hide-details
        v-model="enabled"
        :indeterminate="indeterminate"
      ></v-checkbox>
    </v-col>
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
    <v-col class="pa-0" cols="7">
      <v-row>
        <v-col class="pa-0 d-flex align-center">
          <div class="text-subtitle-2 mb-0.875rem" v-text="property.name"></div>
        </v-col>
        <v-col cols="7" class="pa-0">
          <layer-select
            v-if="propertyLayer !== undefined"
            v-model="propertyLayer"
            label=""
            :any="false"
          ></layer-select>
          <tag-filter-editor
            v-if="propertyFilter !== undefined"
            v-model="propertyFilter"
            property="true"
          ></tag-filter-editor>
        </v-col>
      </v-row>
    </v-col>
  </v-row>
</template>

<script lang="ts">
import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import LayerSelect from "@/components/LayerSelect.vue";

import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import propertyStore from "@/store/properties";
import filterStore from "@/store/filters";
import { ITagAnnotationFilter } from "@/store/model";

@Component({
  components: {
    TagFilterEditor,
    LayerSelect
  }
})
export default class AnnotationProperty extends Vue {
  readonly propertyStore = propertyStore;
  readonly filterStore = filterStore;

  @Prop()
  private readonly property!: any;

  get propertyFilter() {
    return this.property.filter;
  }

  set propertyFilter(value: ITagAnnotationFilter) {
    this.propertyStore.replaceProperty({ ...this.property, filter: value });
  }

  get propertyLayer() {
    return this.property.layer;
  }

  set propertyLayer(value) {
    this.propertyStore.replaceProperty({ ...this.property, layer: value });
  }

  get filter() {
    return this.filterStore.filterIds.includes(this.property.id);
  }

  get list() {
    return this.propertyStore.annotationListIds.includes(this.property.id);
  }

  get enabled() {
    return this.property.enabled;
  }

  set enabled(val) {
    {
      if (val) {
        Promise.resolve().then(() =>
          this.propertyStore.enableProperty(this.property)
        );
      } else {
        this.propertyStore.disableProperty(this.property);
      }
    }
  }

  get computed() {
    return this.property.computed;
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