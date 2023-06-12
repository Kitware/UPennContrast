<template>
  <div class="body-1">
    Show
    <v-select
      dense
      hide-details
      single-line
      class="mx-2"
      v-model="shape"
      :items="shapeItems"
      item-text="text"
      item-value="value"
    />
    objects
  </div>
</template>

<script lang="ts">
import { Vue, Component, VModel } from "vue-property-decorator";
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

  readonly shapeItems: { text: string; value: AnnotationShape | null }[] = [
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
    },
    {
      text: "Any",
      value: null
    }
  ];

  get shape() {
    return this.filter.enabled ? this.filter.shape : null;
  }

  set shape(shape: AnnotationShape | null) {
    if (shape) {
      this.filter = { ...this.filter, enabled: true, shape };
    } else {
      this.filter = { ...this.filter, enabled: false };
    }
  }
}
</script>
