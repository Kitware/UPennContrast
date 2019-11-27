<template>
  <div class="image">
    <canvas
      class="canvas"
      ref="canvas"
      :data-update="reactiveDraw"
      :style="{ transform: cssTransform }"
    />
    <!-- <resize-observer @notify="handleResize" /> -->
  </div>
</template>
<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";
import { select, event as d3Event } from "d3-selection";
import { zoom as d3Zoom, D3ZoomEvent, zoomIdentity } from "d3-zoom";

@Component
export default class ImageViewer extends Vue {
  readonly store = store;

  private refsMounted = false;
  private width = 10;
  private height = 10;
  private transform = Object.assign({}, zoomIdentity);

  readonly zoom = d3Zoom<HTMLElement, any>().on("zoom", () => {
    this.zoomed(d3Event as D3ZoomEvent<HTMLElement, any>);
  });

  $refs!: {
    canvas: HTMLCanvasElement;
  };

  get cssTransform() {
    return `translate(${this.transform.x}px, ${this.transform.y}px) scale(${this.transform.k})`;
  }

  mounted() {
    this.refsMounted = true;
    this.handleResize();
    this.initZoom();
  }

  private initZoom() {
    select(this.$el as HTMLElement).call(this.zoom);
  }

  private zoomed(evt: D3ZoomEvent<HTMLElement, any>) {
    this.transform = evt.transform;
    console.log(evt.transform.toString());
  }

  handleResize() {
    const { width, height } = this.$el.getBoundingClientRect();
    this.width = width - 1;
    this.height = height - 1;
  }

  get reactiveDraw() {
    if (!this.refsMounted || !this.$refs.canvas) {
      return;
    }
    this.draw(this.$refs.canvas);
  }

  private draw(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillRect(10, 10, 10, 10);

    // TODO
  }
}
</script>

<style lang="scss" scoped>
.image {
  position: relative;
  overflow: hidden;
}

.canvas {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
}
</style>
