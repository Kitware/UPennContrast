<template>
  <div class="histogram">
    <svg :width="width" :height="height">
      <path class="hist" :d="areaPath" />
    </svg>
    <resize-observer @notify="handleResize" />
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import { IContrast } from "../store/model";
import { ITileHistogram } from "../store/images";
import { scaleLinear, scalePoint } from "d3-scale";
import { area, curveStep } from "d3-shape";

@Component
export default class ContrastHistogram extends Vue {
  @Prop()
  readonly value!: IContrast;
  @Prop()
  readonly histogram!: Promise<ITileHistogram>;

  width = 100;
  height = 100;

  histData: ITileHistogram | null = null;

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
  }

  handleResize() {
    const { width, height } = this.$el.getBoundingClientRect();
    this.width = width;
    this.height = height;
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
  height: 4em;
  position: relative;
  display: flex;
  justify-content: space-around;
}

.hist {
  fill: rgba(255, 255, 255, 0.7);
}
</style>
