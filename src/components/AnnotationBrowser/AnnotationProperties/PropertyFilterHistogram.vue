<template>
  <v-container v-if="propertyFullName">
    <v-row class="title text--primary d-flex align-center">
      <v-checkbox
        v-model="propertyFilter.enabled"
        class="ml-4"
        dense
        hide-details
        @change="toggleFilterEnabled"
      ></v-checkbox>
      <span>{{ propertyFullName }}</span>
      <v-btn-toggle
        v-model="propertyFilter.valuesOrRange"
        mandatory
        class="ml-4"
        dense
        @change="updateViewMode"
      >
        <v-btn value="range" small>Histogram</v-btn>
        <v-btn value="values" small>Values</v-btn>
      </v-btn-toggle>
      <v-spacer></v-spacer>
      <v-btn icon small class="mr-2" @click="removeFilter">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-row>

    <template v-if="propertyFilter.valuesOrRange === 'range'">
      <v-row>
        <v-col class="wrapper" ref="wrapper" :style="{ width: `${width}px` }">
          <svg :width="width" :height="height" v-if="hist">
            <path class="path" :d="area" />
          </svg>
          <div class="min-hint" :style="{ width: toValue(minValue) }"></div>
          <div
            class="max-hint"
            :style="{ width: toValue(maxValue, true) }"
          ></div>
          <div ref="min" class="min" :style="{ left: toValue(minValue) }"></div>
          <div
            ref="max"
            class="max"
            :style="{ right: toValue(maxValue, true) }"
          ></div>
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
    </template>

    <template v-else>
      <v-row>
        <v-col>
          <v-textarea
            v-model="valuesInput"
            dense
            rows="4"
            hide-details
            placeholder="Enter values separated by spaces, commas, tabs, or newlines"
            @input="debouncedUpdateValues"
          ></v-textarea>
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import store from "@/store";
import propertyStore from "@/store/properties";
import filterStore from "@/store/filters";
import { arePathEquals, getValueFromObjectAndPath } from "@/utils/paths";
import { selectAll, event as d3Event } from "d3-selection";
import { drag, D3DragEvent } from "d3-drag";

import { IPropertyAnnotationFilter } from "@/store/model";
import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import { area, curveStepBefore } from "d3-shape";
import { v4 as uuidv4 } from "uuid";

import { scaleLinear, scaleSymlog } from "d3-scale";
import debounce from "lodash/debounce";

@Component({
  components: {
    TagFilterEditor,
  },
})
export default class PropertyFilterHistogram extends Vue {
  readonly store = store;
  readonly propertyStore = propertyStore;
  readonly filterStore = filterStore;

  @Prop()
  readonly propertyPath!: string[];

  width = 300;
  height = 60;

  useLog: boolean = false;
  useCDF: boolean = false;

  defaultMinMax: boolean = true;

  valuesInput: string = "";

  debouncedUpdateValues = debounce(this.updateValuesFilter, 500);

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
      range: { min, max: this.maxValue },
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
      range: { min: this.minValue, max },
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
      (value: IPropertyAnnotationFilter) =>
        arePathEquals(value.propertyPath, this.propertyPath),
    );
    if (!filter) {
      const newFilter: IPropertyAnnotationFilter = {
        range: { min: this.defaultMin, max: this.defaultMax },

        id: uuidv4(),
        propertyPath: this.propertyPath,
        exclusive: false,
        enabled: true,
        valuesOrRange: "range",
      };
      this.filterStore.updatePropertyFilter(newFilter);
      return newFilter;
    }
    return filter;
  }

  get propertyFullName() {
    return this.propertyStore.getFullNameFromPath(this.propertyPath);
  }

  get values() {
    const valuesForThisProperty: number[] = [];
    const propertyValues = this.propertyStore.propertyValues;
    for (const annotationId in propertyValues) {
      const valuesPerProperty = propertyValues[annotationId];
      const value = getValueFromObjectAndPath(
        valuesPerProperty,
        this.propertyPath,
      );
      if (typeof value === "number") {
        valuesForThisProperty.push(value);
      }
    }
    return valuesForThisProperty;
  }

  get hist() {
    return this.filterStore.getHistogram(this.propertyPath) || [];
  }

  get area() {
    const nInitial = this.hist.length;
    if (nInitial === 0) {
      return "";
    }
    // Create a dummy point in histogram because of curveStepBefore
    const minIntensity = this.hist[0].min;
    const maxIntensity = this.hist[nInitial - 1].max;
    const dummyFirstPoint = {
      count: 0,
      min: minIntensity,
      max: minIntensity,
    };
    const hist = [dummyFirstPoint, ...this.hist];

    // We need to show densities instead of counts on the Y axis
    // Density of the dummyFirstPoint is 0 and won't cause problems
    const densities = hist.map(({ count, min, max }) =>
      max <= min ? 0 : count / (max - min),
    );
    if (this.useCDF) {
      for (let i = 1; i < densities.length; ++i) {
        densities[i] += densities[i - 1];
      }
    }

    // On the x axis
    const intensities = hist.map(({ max }) => max);

    const scaleY = this.useLog ? scaleSymlog() : scaleLinear();
    scaleY.domain([0, Math.max(...densities)]);
    scaleY.range([this.height, 0]);

    const scaleX = scaleLinear();
    scaleX.domain([minIntensity, maxIntensity]);
    scaleX.range([0, this.width]);

    const gen = area<number>()
      .curve(curveStepBefore)
      .x((_, i) => scaleX(intensities[i])!)
      .y0(scaleY(0))
      .y1((d) => scaleY(d)!);
    return gen(densities) ?? undefined;
  }

  destroyed() {
    if (this.propertyFilter.enabled) {
      this.filterStore.updatePropertyFilter({
        ...this.propertyFilter,
        enabled: false,
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

  @Watch("hist")
  initializeHandles() {
    if (this.$refs.min && this.$refs.max) {
      const min = this.$refs.min as HTMLElement;
      const max = this.$refs.max as HTMLElement;

      const onDrag = (which: "min" | "max") => {
        const evt = d3Event as D3DragEvent<HTMLElement, any, any>;
        this.updateMinMax(which, Math.max(0, Math.min(evt.x, this.width)));
      };

      const dragBehavior = drag<HTMLElement, any>().on("drag", onDrag);

      selectAll([min, max]).data(["min", "max"]).call(dragBehavior);
    }
  }

  mounted() {
    // Initialize valuesInput if we have existing values
    if (
      this.propertyFilter.valuesOrRange === "values" &&
      this.propertyFilter.values
    ) {
      this.valuesInput = this.propertyFilter.values.join(", ");
    }

    // TODO(performance): should update only the related histogram
    this.filterStore.updateHistograms();
    if (!this.propertyFilter.enabled) {
      this.filterStore.updatePropertyFilter({
        ...this.propertyFilter,
        enabled: true,
      });
    }
    this.initializeHandles();
  }

  updateValuesFilter() {
    const values = this.valuesInput
      .split(/[\s,;\t\n]+/)
      .map((v) => v.trim())
      .filter((v) => v !== "")
      .map(Number)
      .filter((v) => !isNaN(v));

    if (values.length > 0) {
      this.filterStore.updatePropertyFilter({
        ...this.propertyFilter,
        values: values,
      });
    }
  }

  updateViewMode(mode: "range" | "values") {
    this.filterStore.updatePropertyFilter({
      ...this.propertyFilter,
      valuesOrRange: mode,
      // Clear values when switching to range mode
      values: mode === "range" ? undefined : this.propertyFilter.values,
    });
    // Force reinitialize handles when switching to range mode
    if (mode === "range") {
      this.$nextTick(() => {
        this.initializeHandles();
      });
    } else {
      // If we are switching to values mode, update the values filter
      this.updateValuesFilter();
    }
  }

  toggleFilterEnabled(enabled: boolean) {
    this.filterStore.updatePropertyFilter({
      ...this.propertyFilter,
      enabled,
    });
  }

  removeFilter() {
    this.filterStore.togglePropertyPathFiltering(this.propertyPath);
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

.v-input--selection-controls {
  margin-top: 0;
  padding-top: 0;
}

.v-btn.v-btn--icon.v-size--small {
  width: 24px;
  height: 24px;
}
</style>
