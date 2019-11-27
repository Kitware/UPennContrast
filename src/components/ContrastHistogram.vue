<template>
  <div class="histogram">
    <div class="bin" v-for="(bin, index) in bins" :key="index">
      <div :style="{ height: `${bin.percentage}%` }" :title="bin.value" />
    </div>
    <resize-observer @notify="handleResize" />
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import { IContrast } from "../store/model";
import { ITileHistogram } from "../store/images";
import { scaleLinear } from "d3-scale";

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

  get bins() {
    if (!this.histData) {
      return [];
    }
    const bins = this.histData.hist;
    const scale = scaleLinear()
      .domain([0, bins.reduce((acc, v) => Math.max(acc, v), 0)])
      .range([0, 100]);
    return bins.map(v => ({ value: v, percentage: scale(v) }));
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

.bin {
  flex: 1 1 0;
  position: relative;

  > * {
    position: absolute;
    left: 0;
    width: 100%;
    bottom: 0;
    background: rgba(255, 255, 255, 0.7);
  }
}
</style>
