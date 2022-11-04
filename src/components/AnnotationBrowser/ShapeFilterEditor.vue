<template>
  <div v-if="filter">
    <v-container>
      <v-row>
        <v-col cols="auto" class="pa-1" v-if="!property">
          <v-checkbox
            dense
            hide-details
            label="Enable Shape Filter"
            v-model="enabled"
          ></v-checkbox>
        </v-col>
        <v-col v-if="!property" class="py-0">
          <v-select
            dense
            hide-details
            v-model="shape"
            :items="shapeItems"
            item-text="text"
            item-value="value"
            :disabled="!enabled"
          ></v-select>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>
<script lang="ts">
import { Vue, Component, Watch, Prop, VModel } from "vue-property-decorator";
import {
  IShapeAnnotationFilter,
  AnnotationNames,
  AnnotationShape
} from "@/store/model";

@Component({
  components: {}
})
export default class TagFilterEditor extends Vue {
  @VModel({ type: Object }) filter!: IShapeAnnotationFilter;

  shapeItems: { value: string; text: string }[] = [
    {
      text: AnnotationNames[AnnotationShape.Point],
      value: AnnotationShape.Point
    },
    {
      text: AnnotationNames[AnnotationShape.Polygon],
      value: AnnotationShape.Polygon
    },
    {
      text: AnnotationNames[AnnotationShape.Line],
      value: AnnotationShape.Line
    }
  ];

  @Prop()
  readonly property!: boolean;

  get shape() {
    return this.filter.shape;
  }

  set shape(shape: AnnotationShape) {
    this.filter = { ...this.filter, shape };
  }

  get enabled() {
    return this.filter.enabled;
  }

  set enabled(enabled: boolean) {
    this.filter = { ...this.filter, enabled };
  }
}
</script>
