<template>
  <div class="histogram">
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
      <div class="min-hint" :style="{ width: blackPoint }" />
      <div class="max-hint" :style="{ width: whitePoint }" />
      <div
        ref="min"
        class="min"
        :title="toLabel(value.blackPoint)"
        :style="{ left: blackPoint }"
      />
      <div
        class="saved-min"
        :style="{ left: savedBlackPoint }"
        :title="`Saved: ${toLabel(value.savedBlackPoint)}`"
      />
      <div
        ref="max"
        class="max"
        :title="toLabel(value.whitePoint)"
        :style="{ right: whitePoint }"
      />
      <div
        class="saved-max"
        :style="{ right: savedWhitePoint }"
        :title="`Saved: ${toLabel(value.savedWhitePoint)}`"
      />
      <resize-observer @notify="handleResize" />
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
        @click="resetSaved"
        color="secondary"
        title="Reset to saved points"
      >
        Reset to saved
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

@Component({
  components: {
    SwitchToggle
  }
})
export default class ContrastHistogram extends Vue {
  @Prop()
  readonly value!: IContrast;
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

  get mode() {
    return this.value.mode;
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

  private computeValue(value: number, isWhite = false) {
    if (!this.histData) {
      return 0;
    }
    const base =
      this.value.mode === "percentile"
        ? this.percentageToPixel(value)
        : this.histToPixel(value);
    if (isWhite) {
      return `${this.width - base}px`;
    }
    return `${base}px`;
  }

  get blackPoint() {
    return this.computeValue(this.value.blackPoint);
  }

  get savedBlackPoint() {
    return this.computeValue(this.value.savedBlackPoint);
  }

  get whitePoint() {
    return this.computeValue(this.value.whitePoint, true);
  }

  get savedWhitePoint() {
    return this.computeValue(this.value.savedWhitePoint, true);
  }

  toLabel(value: number) {
    switch (this.value.mode) {
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
        drag<HTMLElement, any>()
          .on("drag", (which: "blackPoint" | "whitePoint") => {
            const evt = d3Event as D3DragEvent<HTMLElement, any, any>;
            this.updatePoint(which, evt.x);
          })
          .on("end", () => this.commitChanges())
      );
  }

  private updatePoint(which: "blackPoint" | "whitePoint", pixel: number) {
    const copy = Object.assign({}, this.value);

    switch (this.value.mode) {
      case "percentile":
        copy[which] = this.percentageToPixel.invert(pixel);
        break;
      default:
        copy[which] = this.histToPixel.invert(pixel);
        break;
    }
    this.$emit("change", copy);
  }

  private commitChanges() {
    this.$emit("commit", Object.assign({}, this.value));
  }

  set mode(value: "percentile" | "absolute") {
    const copy = Object.assign({}, this.value);
    copy.mode = value;

    const perToAbs = (v: number) =>
      this.percentageToPixel.invert(this.histToPixel(v));
    const absToPer = (v: number) =>
      this.histToPixel.invert(this.percentageToPixel(v));
    const converter = value === "percentile" ? absToPer : perToAbs;

    copy.blackPoint = converter(copy.blackPoint);
    copy.whitePoint = converter(copy.whitePoint);
    copy.savedBlackPoint = converter(copy.savedBlackPoint);
    copy.savedWhitePoint = converter(copy.savedWhitePoint);

    this.$emit("commit", copy);
  }

  reset() {
    const copy = Object.assign({}, this.value);
    const scale =
      this.value.mode === "percentile"
        ? this.percentageToPixel
        : this.histToPixel;
    copy.blackPoint = scale.invert(0);
    copy.whitePoint = scale.invert(this.width);
    this.$emit("commit", copy);
  }

  resetSaved() {
    const copy = Object.assign({}, this.value);
    copy.blackPoint = copy.savedBlackPoint;
    copy.whitePoint = copy.savedWhitePoint;
    this.$emit("commit", copy);
  }

  saveCurrent() {
    const copy = Object.assign({}, this.value);
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
    const scaleY = scaleLinear()
      .domain([0, bins.reduce((acc, v) => Math.max(acc, v), 0)])
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
  margin: 0.5em 0;
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

.path {
  fill: rgba(255, 255, 255, 0.7);
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
  border-right: 1px solid lightgray;
  transition: border-width 0.2s ease;
  width: 1px;
  cursor: ew-resize;
}

.max {
  right: 0;
  border-right: none;
  border-left: 1px solid lightgray;
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

  border-top: $savedHint solid lightgray;
}

.saved-max {
  transform: translateX(#{$savedHint});
}

.min-hint,
.max-hint {
  position: absolute;
  top: 0;
  height: 100%;
  user-select: none;
  pointer-events: none;

  background: repeating-linear-gradient(
    -45deg,
    rgba(255, 255, 255, 0.5),
    rgba(255, 255, 255, 0.5) 5px,
    #696969 5px,
    #696969 10px
  );
}

.min-hint {
  left: 0;
}

.max-hint {
  right: 0;
}
</style>
