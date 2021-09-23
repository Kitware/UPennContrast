<template>
  <v-container v-if="property">
    <v-row>
      {{ property.name }}
    </v-row>
    <v-row>
      <v-col cols="6">
        <svg :width="width" :height="height">
          <path class="path" :d="area" />
        </svg>
      </v-col>
      <v-col>
        <v-checkbox v-model="useCDF" label="CDF"></v-checkbox>
      </v-col>
      <v-col>
        <v-checkbox v-model="useLog" label="log"></v-checkbox>
      </v-col>
    </v-row>
    <v-row>
      <v-col class="pa-1">
        <v-text-field
          dense
          hide-details
          label="Min"
          type="number"
          v-model="minValue"
        ></v-text-field>
      </v-col>
      <v-col class="pa-1">
        <v-text-field
          dense
          hide-details
          type="number"
          label="Max"
          v-model="maxValue"
        ></v-text-field>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch, VModel } from "vue-property-decorator";
import store from "@/store";
import propertyStore from "@/store/properties";
import filterStore from "@/store/filters";

import {
  IAnnotation,
  ITagAnnotationFilter,
  IPropertyAnnotationFilter
} from "@/store/model";
import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import { bin } from "d3-array";
import { area, curveStep } from "d3-shape";

import { scaleLinear, scalePoint, scaleSymlog, ScaleSymLog } from "d3-scale";

@Component({
  components: {
    TagFilterEditor
  }
})
export default class AnnotationFilter extends Vue {
  readonly store = store;
  readonly propertyStore = propertyStore;
  readonly filterStore = filterStore;

  width = 200;
  height = 60;

  useLog: boolean = false;
  useCDF: boolean = false;

  defaultMinMax: boolean = true;
  max = 0;

  get minValue() {
    return this.defaultMinMax ? this.defaultMin : this.propertyFilter.range.min;
  }

  get maxValue() {
    return this.defaultMinMax ? this.defaultMax : this.propertyFilter.range.max;
  }

  set minValue(value) {
    const min = Number(value);
    if (min > this.maxValue || min < this.defaultMin) {
      return;
    }
    if (this.defaultMinMax) {
      this.defaultMinMax = false;
    }
    this.filterStore.updatePropertyFilter({
      ...this.propertyFilter,
      range: { min, max: this.maxValue }
    });
  }

  set maxValue(value) {
    const max = Number(value);
    if (max < this.minValue || max > this.defaultMax) {
      return;
    }
    if (this.defaultMinMax) {
      this.defaultMinMax = false;
    }
    this.filterStore.updatePropertyFilter({
      ...this.propertyFilter,
      range: { min: this.minValue, max }
    });
    this.max = Number(value);
  }

  get defaultMin() {
    return Math.min(...this.values);
  }

  get defaultMax() {
    return Math.max(...this.values);
  }

  get propertyFilters() {
    return this.filterStore.propertyFilters;
  }

  get propertyFilter() {
    const filter = this.propertyFilters.find(
      (value: IPropertyAnnotationFilter) => value.propertyId === this.propertyId
    );
    if (!filter) {
      const newFilter: IPropertyAnnotationFilter = {
        range: { min: this.defaultMin, max: this.defaultMax },

        id: this.propertyId, // TODO: check this
        propertyId: this.propertyId,
        exclusive: false,
        enabled: true
      };
      this.filterStore.updatePropertyFilter(newFilter);
      return newFilter;
    }
    return filter;
  }

  @Prop()
  readonly propertyId!: string;
  get property() {
    return this.propertyStore.getPropertyById(this.propertyId);
  }

  get values() {
    return [];
  }

  get cdf() {
    const data = [...this.bins];
    for (let i = 0; i < data.length; ++i) {
      if (i > 0) {
        data[i] += data[i - 1];
      }
    }
    return data;
  }

  get bins() {
    return bin()(this.values).map((bin: number[]) => bin.length);
  }

  get curve() {
    return this.useCDF ? this.cdf : this.bins;
  }

  get area() {
    if (!this.curve) {
      return "";
    }
    const scaleY = this.useLog
      ? scaleSymlog()
          .domain([0, Math.max(...this.curve)])
          // .constant(0.01)
          .range([this.height, 0])
      : scaleLinear()
          .domain([0, Math.max(...this.curve)])
          .range([this.height, 0]);

    const scaleX = scalePoint<number>()
      .domain(this.curve.map((_: number, i: number) => i))
      .range([0, this.width]);

    const gen = area<number>()
      .curve(curveStep)
      .x((_, i) => scaleX(i)!)
      .y0(d => scaleY(d)!)
      .y1(scaleY(0));
    return gen(this.curve);
  }

  destroyed() {
    if (this.propertyFilter.enabled) {
      this.filterStore.updatePropertyFilter({
        ...this.propertyFilter,
        enabled: false
      });
    }
  }

  mounted() {
    if (!this.propertyFilter.enabled) {
      this.filterStore.updatePropertyFilter({
        ...this.propertyFilter,
        enabled: true
      });
    }
  }
}
</script>
<style scoped lang="scss">
.theme--dark {
  .path {
    fill: #c2c2c2;
  }
}

.theme--light {
  .path {
    fill: #c2c2c2;
  }
}
</style>
