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
      <svg :width="width" :height="height" ref="svg">
        <path class="path" :d="areaPath" ref="path" />
      </svg>
      <div
        class="min-hint"
        :style="{ width: toValue(currentContrast, 'black') }"
      />
      <div
        class="max-hint"
        :style="{ width: toValue(currentContrast, 'white') }"
      />
      <div
        ref="min"
        class="min"
        :style="{ left: toValue(currentContrast, 'black') }"
        :title="toLabel(currentContrast.blackPoint)"
      />
      <div
        class="saved-min"
        :style="{ left: toValue(configurationContrast, 'black') }"
        :title="`Saved: ${toLabel(configurationContrast.blackPoint)}`"
      />
      <div
        ref="max"
        class="max"
        :style="{ right: toValue(currentContrast, 'white') }"
        :title="toLabel(currentContrast.whitePoint)"
      />
      <div
        class="saved-max"
        :style="{ right: toValue(configurationContrast, 'white') }"
        :title="`Saved: ${toLabel(configurationContrast.whitePoint)}`"
      />
      <resize-observer @notify="handleResize" />
    </div>
    <div class="sub">
      <v-text-field
        type="number"
        v-model="editBlackPoint"
        @keydown="validateCachedBlackPoint"
        :append-icon="editIcon"
        hide-details
        dense
      />
      <v-text-field
        type="number"
        v-model="editWhitePoint"
        @keydown="validateCachedWhitePoint"
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
import { select, selectAll, event as d3Event } from "d3-selection";
import { drag, D3DragEvent } from "d3-drag";
import { throttle } from "lodash";
import { zoom, D3ZoomEvent, ZoomBehavior } from "d3-zoom";

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

  scale: number = 1;
  translation: number = 0;

  $refs!: {
    min: HTMLElement;
    max: HTMLElement;
    svg: HTMLElement;
    path: HTMLElement;
  };

  _zoomBehavior: ZoomBehavior<HTMLElement, any> | null = null;

  _uid!: string; // Vue has that appearantly

  // For typing contrast in text fields and hitting "Enter"
  cachedBlackPoint: number | null = null;
  cachedWhitePoint: number | null = null;

  get currentContrast() {
    return this.viewContrast || this.configurationContrast;
  }

  get mode() {
    return this.viewContrast?.mode || this.configurationContrast.mode;
  }

  get editMin() {
    return this.mode === "percentile" || !this.histData ? 0 : this.histData.min;
  }

  get editMax() {
    return this.mode === "percentile" || !this.histData
      ? 100
      : this.histData.max;
  }

  get editIcon() {
    switch (this.mode) {
      case "percentile":
        return "mdi-percent";
      default:
        return undefined;
    }
  }

  get pixelRange() {
    return [this.translation, this.translation + this.scale * this.width];
  }

  get histToPixel() {
    const scale = scaleLinear()
      .domain([0, 100])
      .range(this.pixelRange);
    if (this.histData) {
      scale.domain([this.histData.min, this.histData.max]);
    }
    return scale;
  }

  get percentageToPixel() {
    return scaleLinear()
      .domain([0, 100])
      .range(this.pixelRange);
  }

  get toValue() {
    const clamp = (x: number) => Math.min(this.width, Math.max(0, x));
    return (contrast: IContrast, color: "white" | "black") => {
      const convert =
        contrast.mode === "percentile"
          ? this.percentageToPixel
          : this.histToPixel;
      switch (color) {
        case "white":
          return `${clamp(this.width - convert(contrast.whitePoint))}px`;
        case "black":
          return `${clamp(convert(contrast.blackPoint))}px`;
      }
    };
  }

  toLabel(value: number) {
    switch (this.mode) {
      case "percentile":
        return `${Math.round(value * 100) / 100}%`;
      default:
        return Math.round(value).toString();
    }
  }

  @Watch("histogram")
  onValueChange(hist: Promise<ITileHistogram>) {
    this.histData = null;
    hist.then(data => (this.histData = data));
  }

  created() {
    this.histogram.then(data => (this.histData = data));
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

    select(this.$refs.svg).call(this.getZoomBehavior());
  }

  @Watch("width")
  getZoomBehavior() {
    if (!this._zoomBehavior) {
      this._zoomBehavior = zoom<HTMLElement, any>()
        .scaleExtent([1, 32])
        .on("zoom", this.updatePanAndZoom);
    }
    return this._zoomBehavior.translateExtent([
      [0, 0],
      [this.width, 0]
    ]);
  }

  updatePanAndZoom() {
    const evt = d3Event as D3ZoomEvent<HTMLElement, any>;
    const transform = evt.transform;
    this.translation = transform.x;
    this.scale = transform.k;
    const transformString =
      "translate(" + this.translation + ",0" + ") scale(" + this.scale + ",1)";
    select(this.$refs.path).attr("transform", transformString);
  }

  private updatePoint(which: "blackPoint" | "whitePoint", pixel: number) {
    const copy = Object.assign({}, this.currentContrast);

    switch (this.mode) {
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
    } else {
      // ensure not overlapping
      copy.whitePoint = Math.max(copy.whitePoint, copy.blackPoint);
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

    this.emitChange.call(this, copy);
  }

  get editBlackPoint() {
    return this.currentContrast.blackPoint;
  }

  set editBlackPoint(value: number) {
    const copy = Object.assign({}, this.currentContrast);
    copy.blackPoint = typeof value === "string" ? parseInt(value, 10) : value;
    if (copy.blackPoint <= copy.whitePoint) {
      this.emitChange.call(this, copy);
      this.cachedBlackPoint = null;
    } else {
      this.cachedBlackPoint = copy.blackPoint;
    }
  }

  validateCachedBlackPoint(event: KeyboardEvent) {
    if (
      event.key === "Enter" &&
      this.cachedBlackPoint !== null &&
      this.cachedBlackPoint > this.editWhitePoint
    ) {
      this.editBlackPoint = this.editWhitePoint;
    }
  }

  get editWhitePoint() {
    return this.currentContrast.whitePoint;
  }

  set editWhitePoint(value: number) {
    const copy = Object.assign({}, this.currentContrast);
    copy.whitePoint = typeof value === "string" ? parseInt(value, 10) : value;
    if (copy.blackPoint <= copy.whitePoint) {
      this.emitChange.call(this, copy);
      this.cachedWhitePoint = null;
    } else {
      this.cachedWhitePoint = copy.whitePoint;
    }
  }

  validateCachedWhitePoint(event: KeyboardEvent) {
    if (
      event.key === "Enter" &&
      this.cachedWhitePoint !== null &&
      this.editBlackPoint > this.cachedWhitePoint
    ) {
      this.editWhitePoint = this.editBlackPoint;
    }
  }

  reset() {
    const copy = Object.assign({}, this.currentContrast);
    const scale =
      this.mode === "percentile" ? this.percentageToPixel : this.histToPixel;
    copy.blackPoint = scale.invert(0);
    copy.whitePoint = scale.invert(this.width);
    this.emitChange.call(this, copy);
  }

  revertSaved() {
    this.$emit("revert");
  }

  saveCurrent() {
    const copy = Object.assign({}, this.currentContrast);
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
    return gen(bins) || undefined;
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
