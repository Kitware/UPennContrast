<template>
  <v-container v-if="property">
    <v-row>
      {{ property.name }}
    </v-row>
    <v-row>
      <v-col class="wrapper" ref="wrapper" :style="{width: `${width}px`}">
        <svg :width="width" :height="height">
          <path class="path" :d="area" />
        </svg>
        <div class="min-hint" :style="{ width: toValue(minValue) }" />
        <div class="max-hint" :style="{ width: toValue(maxValue, true) }" />
        <div ref="min" class="min" :style="{ left: toValue(minValue) }" />
        <div
          ref="max"
          class="max"
          :style="{ right: toValue(maxValue, true) }"
        />
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
import { selectAll, event as d3Event } from "d3-selection";
import { drag, D3DragEvent } from "d3-drag";

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

  width = 300;
  height = 60;

  useLog: boolean = false;
  useCDF: boolean = false;

  defaultMinMax: boolean = true;

  get histToPixel() {
    const scale = scaleLinear()
      .range([0, this.width])
      .domain([this.defaultMin, this.defaultMax]);
    return scale;
  }

  toValue(val: number, isMax: boolean = false) {
    const base = this.histToPixel(val);
    if (isMax) {
      return `${this.width - base}px`;
    }
    return `${base}px`;
  }

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

  private updateMinMax(which: "min" | "max", pixel: number) {
    const val = Math.round(this.histToPixel.invert(pixel));
    if (which === "min") {
      this.minValue = Math.min(this.maxValue, val);
    } else {
      this.maxValue = Math.max(this.minValue, val);
    }
  }

  mounted() {
    if (!this.propertyFilter.enabled) {
      this.filterStore.updatePropertyFilter({
        ...this.propertyFilter,
        enabled: true
      });
    }
    if (this.$refs.min && this.$refs.max) {
      selectAll([this.$refs.min, this.$refs.max])
        .data(["min", "max"])
        .call(
          drag<HTMLElement, any>().on("drag", (which: "min" | "max") => {
            const evt = d3Event as D3DragEvent<HTMLElement, any, any>;
            this.updateMinMax(which, Math.max(0, Math.min(evt.x, this.width)));
          })
        );
    }
  }
}
</script>
<style scoped lang="scss">
.wrapper {
  margin-top: 0.5em;
  position: relative;
  display: flex;

  &:hover {
    > .min {
      border-right-width: 5px;
    }

    > .max {
      border-left-width: 5px;
    }
  }
}
.min,
.max {
  position: absolute;
  top: 0;
  height: 100%;
  transition: border-width 0.2s ease;
  width: 1px;
  cursor: ew-resize;
}

.max {
  right: 0;
  border-right: none;
}

$savedHint: 7px;
.min-hint,
.max-hint {
  position: absolute;
  top: 0;
  height: 100%;
  user-select: none;
  pointer-events: none;
}

.min-hint {
  left: 0;
}

.max-hint {
  right: 0;
}

.theme--dark {
  .path {
    fill: #c2c2c2;
  }

  .min {
    border-right: 1px solid lightgray;
  }

  .max {
    border-left: 1px solid lightgray;
  }

  .saved-min,
  .saved-max {
    border-top: $savedHint solid lightgray;
  }

  .min-hint,
  .max-hint {
    background: repeating-linear-gradient(
      -45deg,
      rgba(255, 255, 255, 0.5),
      rgba(255, 255, 255, 0.5) 5px,
      #696969 5px,
      #696969 10px
    );
  }
}

.theme--light {
  .path {
    fill: #c2c2c2;
  }
  .min {
    border-right: 1px solid darkgray;
  }

  .max {
    border-left: 1px solid darkgray;
  }

  .min-hint,
  .max-hint {
    background: repeating-linear-gradient(
      -45deg,
      rgba(255, 255, 255, 0.5),
      rgba(255, 255, 255, 0.5) 5px,
      #bdbdbd 5px,
      #bdbdbd 10px
    );
  }
}
</style>
