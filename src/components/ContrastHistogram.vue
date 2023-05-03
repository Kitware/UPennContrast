<template>
  <div
    :class="{
      histogram: true,
      'theme--light': !$vuetify.theme.dark,
      'theme--dark': $vuetify.theme.dark
    }"
  >
    <switch-toggle
      v-model="mode"
      label="Mode: "
      true-label="Absolute"
      true-value="absolute"
      false-label="Percentile"
      false-value="percentile"
      :id="`input-${_uid}`"
    />
    <div class="wrapper">
      <svg :width="width" :height="height">
        <path class="path" :d="areaPath" />
      </svg>
      <div class="min-hint" :style="{ width: toValue(currentBlackPoint) }" />
      <div
        class="max-hint"
        :style="{ width: toValue(currentWhitePoint, true) }"
      />
      <div
        ref="min"
        class="min"
        :style="{ left: toValue(currentBlackPoint) }"
        :title="toLabel(currentContrast.blackPoint)"
      />
      <div
        class="saved-min"
        :style="{ left: toValue(currentContrast.savedBlackPoint) }"
        :title="`Saved: ${toLabel(currentContrast.savedBlackPoint)}`"
      />
      <div
        ref="max"
        class="max"
        :style="{ right: toValue(currentWhitePoint, true) }"
        :title="toLabel(currentContrast.whitePoint)"
      />
      <div
        class="saved-max"
        :style="{ right: toValue(currentContrast.savedWhitePoint, true) }"
        :title="`Saved: ${toLabel(currentContrast.savedWhitePoint)}`"
      />
      <resize-observer @notify="handleResize" />
    </div>
    <div class="sub">
      <v-text-field
        type="number"
        :min="editMin"
        :max="editMax"
        v-model="editBlackPoint"
        :append-icon="editIcon"
        hide-details
        dense
      />
      <v-text-field
        type="number"
        :min="editMin"
        :max="editMax"
        v-model="editWhitePoint"
        :append-icon="editIcon"
        hide-details
        dense
      />
    </div>
    <div class="toolbar">
      <v-btn
        x-small
        @click="reset"
        color="secondary"
        title="Reset to histogram limits"
      >
        Reset
      </v-btn>
      <v-btn
        x-small
        @click="revertSaved"
        color="secondary"
        title="Revert to saved points"
      >
        Revert to saved
      </v-btn>
      <v-btn
        x-small
        @click="saveCurrent"
        color="secondary"
        title="Save current points"
        >Save</v-btn
      >
    </div>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import SwitchToggle from "./SwitchToggle.vue";
import { IContrast } from "../store/model";
import { ITileHistogram } from "../store/images";
import { scaleLinear, scalePoint } from "d3-scale";
import { area, curveStep } from "d3-shape";
import { selectAll, event as d3Event } from "d3-selection";
import { drag, D3DragEvent } from "d3-drag";
import { throttle } from "lodash-es";

function roundPer(v: number) {
  return Math.round(v * 100) / 100;
}

function roundAbs(v: number) {
  return Math.round(v);
}

// This is debounced elsewhere
const THROTTLE = 1; // ms

@Component({
  components: {
    SwitchToggle
  }
})
export default class ContrastHistogram extends Vue {
  @Prop()
  readonly configurationContrast!: IContrast;

  @Prop()
  readonly viewContrast!: IContrast | null;

  @Prop()
  readonly histogram!: Promise<ITileHistogram>;

  width = 100;
  readonly height = 80;

  histData: ITileHistogram | null = null;

  $refs!: {
    min: HTMLElement;
    max: HTMLElement;
  };

  _uid!: string; // Vue has that appearantly

  get currentContrast() {
    return this.viewContrast || this.configurationContrast;
  }

  currentBlackPoint = this.currentContrast.blackPoint;
  currentWhitePoint = this.currentContrast.whitePoint;

  @Watch("currentContrast.blackPoint")
  onBlackPointChange(value: number) {
    this.currentBlackPoint = value;
  }

  @Watch("currentContrast.whitePoint")
  onWhitePointChange(value: number) {
    this.currentWhitePoint = value;
  }

  get mode() {
    return this.currentContrast.mode;
  }

  get editMin() {
    return this.currentContrast.mode === "percentile" || !this.histData
      ? 0
      : this.histData.min;
  }
  get editMax() {
    return this.currentContrast.mode === "percentile" || !this.histData
      ? 100
      : this.histData.max;
  }

  get editIcon() {
    return this.currentContrast.mode === "percentile"
      ? "mdi-percent"
      : undefined;
  }

  get histToPixel() {
    const scale = scaleLinear()
      .domain([0, 100])
      .range([0, this.width]);
    if (this.histData) {
      scale.domain([this.histData.min, this.histData.max]);
    }
    return scale;
  }

  get percentageToPixel() {
    return scaleLinear()
      .domain([0, 100])
      .range([0, this.width]);
  }

  toValue(value: number, isWhite = false) {
    const base =
      this.currentContrast.mode === "percentile"
        ? this.percentageToPixel(value)
        : this.histToPixel(value);
    if (isWhite) {
      return `${this.width - base}px`;
    }
    return `${base}px`;
  }

  toLabel(value: number) {
    switch (this.currentContrast.mode) {
      case "percentile":
        return `${Math.round(value * 100) / 100}%`;
      default:
        return Math.round(value).toString();
    }
  }

  @Watch("histogram")
  onValueChange(hist: Promise<ITileHistogram>) {
    this.histData = null;
    hist.then(data => this.setAndVerify(data));
  }

  created() {
    this.histogram.then(data => this.setAndVerify(data));
  }

  private setAndVerify(data: ITileHistogram): void {
    this.histData = data;

    if (this.currentContrast.mode === "percentile") {
      return;
    }

    if (data.max - data.min <= 1) {
      return;
    }

    // ensure the values are within the bounds
    const copy = Object.assign({}, this.currentContrast);
    const clamp = (value: number) =>
      Math.min(Math.max(value, data.min), data.max);
    const keys: (
      | "blackPoint"
      | "whitePoint"
      | "savedBlackPoint"
      | "savedWhitePoint"
    )[] = ["blackPoint", "whitePoint", "savedBlackPoint", "savedWhitePoint"];
    let changed = false;
    keys.forEach(key => {
      const v = clamp(copy[key]);
      changed = changed || v !== copy[key];
      copy[key] = v;
    });

    if (changed) {
      this.emitChange.call(this, copy);
    }
  }

  mounted() {
    this.handleResize();

    selectAll([this.$refs.min, this.$refs.max])
      .data(["blackPoint", "whitePoint"])
      .call(
        drag<HTMLElement, any>().on(
          "drag",
          (which: "blackPoint" | "whitePoint") => {
            const evt = d3Event as D3DragEvent<HTMLElement, any, any>;
            this.updatePoint(which, Math.max(0, Math.min(evt.x, this.width)));
          }
        )
      );
  }

  private updatePoint(which: "blackPoint" | "whitePoint", pixel: number) {
    const copy = Object.assign({}, this.currentContrast);

    switch (this.currentContrast.mode) {
      case "percentile":
        copy[which] = roundPer(this.percentageToPixel.invert(pixel));
        break;
      default:
        copy[which] = roundAbs(this.histToPixel.invert(pixel));
        break;
    }
    if (which === "blackPoint") {
      // ensure not overlapping
      copy.blackPoint = Math.min(copy.blackPoint, copy.whitePoint);
      this.currentBlackPoint = copy.blackPoint;
    } else {
      // ensure not overlapping
      copy.whitePoint = Math.max(copy.whitePoint, copy.blackPoint);
      this.currentWhitePoint = copy.whitePoint;
    }
    this.emitChange.call(this, copy);
  }

  private readonly emitChange = throttle(function(
    this: ContrastHistogram,
    value: IContrast
  ) {
    this.$emit("change", value);
  },
  THROTTLE);

  private commitChanges() {
    this.$emit("commit", Object.assign({}, this.currentContrast));
  }

  set mode(value: "percentile" | "absolute") {
    const copy = Object.assign({}, this.currentContrast);
    copy.mode = value;

    const absToPer = (v: number) =>
      roundPer(this.percentageToPixel.invert(this.histToPixel(v)));
    const perToAbs = (v: number) =>
      roundAbs(this.histToPixel.invert(this.percentageToPixel(v)));
    const converter = value === "percentile" ? absToPer : perToAbs;

    copy.blackPoint = converter(copy.blackPoint);
    copy.whitePoint = converter(copy.whitePoint);
    copy.savedBlackPoint = converter(copy.savedBlackPoint);
    copy.savedWhitePoint = converter(copy.savedWhitePoint);

    this.emitChange.call(this, copy);
  }

  get editBlackPoint() {
    return this.currentBlackPoint;
  }

  set editBlackPoint(value: string | number) {
    const v = typeof value === "string" ? parseInt(value, 10) : value;
    const copy = Object.assign({}, this.currentContrast);
    copy.blackPoint = Math.min(v, copy.whitePoint);
    this.currentBlackPoint = copy.blackPoint;
    this.emitChange.call(this, copy);
  }

  get editWhitePoint() {
    return this.currentWhitePoint;
  }

  set editWhitePoint(value: string | number) {
    const v = typeof value === "string" ? parseInt(value, 10) : value;
    const copy = Object.assign({}, this.currentContrast);
    copy.whitePoint = Math.min(v, copy.blackPoint);
    this.currentWhitePoint = copy.whitePoint;
    this.emitChange.call(this, copy);
  }

  reset() {
    const copy = Object.assign({}, this.currentContrast);
    const scale =
      this.currentContrast.mode === "percentile"
        ? this.percentageToPixel
        : this.histToPixel;
    copy.blackPoint = scale.invert(0);
    copy.whitePoint = scale.invert(this.width);
    this.emitChange.call(this, copy);
  }

  revertSaved() {
    const copy = Object.assign({}, this.currentContrast);
    copy.blackPoint = copy.savedBlackPoint;
    copy.whitePoint = copy.savedWhitePoint;
    this.emitChange.call(this, copy);
  }

  saveCurrent() {
    const copy = Object.assign({}, this.currentContrast);
    copy.savedBlackPoint = copy.blackPoint;
    copy.savedWhitePoint = copy.whitePoint;
    this.$emit("commit", copy);
  }

  handleResize() {
    const { width } = this.$el.getBoundingClientRect();
    this.width = width;
  }

  get areaPath() {
    if (!this.histData) {
      return "";
    }
    const bins = this.histData.hist;
    let maxValue = bins.reduce((acc, v) => Math.max(acc, v), 0);
    const secondMax = bins.reduce(
      (acc, v) => Math.max(acc, v !== maxValue ? v : 0),
      0
    );
    maxValue = Math.min(maxValue, secondMax * 1.5);
    const scaleY = scaleLinear()
      .domain([0, maxValue])
      .range([this.height, 0]);
    const scaleX = scalePoint<number>()
      .domain(bins.map((_, i) => i))
      .range([0, this.width]);

    const gen = area<number>()
      .curve(curveStep)
      .x((_, i) => scaleX(i)!)
      .y0(d => scaleY(d)!)
      .y1(scaleY(0));
    return gen(bins);
  }
}
</script>

<style lang="scss" scoped>
.histogram {
  margin: 0.5em 0 1em 0;
  position: relative;
  display: flex;
  flex-direction: column;
}

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

.toolbar {
  display: flex;
  justify-content: space-evenly;
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

.saved-min,
.saved-max {
  position: absolute;
  top: -$savedHint;
  width: 0;
  height: 0;
  border-left: $savedHint solid transparent;
  border-right: $savedHint solid transparent;
  transform: translateX(#{-$savedHint});

  transition: all 250ms ease;

  &:hover {
    border-left: $savedHint * 1.25 solid transparent;
    border-right: $savedHint * 1.25 solid transparent;
    transform: translateX(#{-$savedHint * 1.25});
  }
}

.saved-max {
  transform: translateX(#{$savedHint});

  &:hover {
    transform: translateX(#{$savedHint * 1.25});
  }
}

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

.sub {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2px;

  > div:first-of-type {
    margin-right: 1em;
  }
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

  .saved-min,
  .saved-max {
    border-top: $savedHint solid darkgray;
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
