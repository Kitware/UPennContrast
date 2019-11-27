<template>
  <div class="image">
    <canvas
      class="canvas"
      ref="canvas"
      :width="width"
      :height="height"
      :data-update="reactiveDraw"
      :style="{ transform: cssTransform }"
    />
    <!-- <resize-observer @notify="handleResize" /> -->
  </div>
</template>
<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import { select, event as d3Event } from "d3-selection";
import { zoom as d3Zoom, D3ZoomEvent, zoomIdentity } from "d3-zoom";
import { IImageTile } from "../store/model";

@Component
export default class ImageViewer extends Vue {
  readonly store = store;

  private refsMounted = false;
  private transform = Object.assign({}, zoomIdentity);

  private containerDimensions = { width: 100, height: 100 };

  readonly zoom = d3Zoom<HTMLElement, any>().on("zoom", () => {
    this.zoomed(d3Event as D3ZoomEvent<HTMLElement, any>);
  });

  private ready: string[] = [];

  $refs!: {
    canvas: HTMLCanvasElement;
  };

  get cssTransform() {
    return `translate(${this.transform.x}px, ${this.transform.y}px) scale(${this.transform.k})`;
  }

  get width() {
    return this.store.dataset ? this.store.dataset.width : 100;
  }

  get height() {
    return this.store.dataset ? this.store.dataset.height : 100;
  }

  get imageStack() {
    return this.store.imageStack;
  }

  private trackImages(value: IImageTile[][]) {
    const ready: string[] = [];
    value.forEach(layer => {
      layer.forEach(tile => {
        if (tile.image.src && tile.image.complete) {
          ready.push(tile.url);
        } else {
          tile.image.onload = () => {
            // not just loaded but also decoded
            tile.image.decode().then(() => {
              this.ready.push(tile.url);
            });
          };
        }
      });
    });
    this.ready = ready;
  }

  @Watch("imageStack")
  watchImageStack(value: IImageTile[][]) {
    this.trackImages(value);
  }

  mounted() {
    this.refsMounted = true;
    this.updateContainerSize();
    this.initZoom();
    this.trackImages(this.imageStack);
  }

  private initZoom() {
    select(this.$el as HTMLElement).call(this.zoom);
  }

  private zoomed(evt: D3ZoomEvent<HTMLElement, any>) {
    this.transform = evt.transform;
  }

  updateContainerSize() {
    const { width, height } = this.$el.getBoundingClientRect();
    this.containerDimensions = { width, height };
  }

  get reactiveDraw() {
    if (!this.refsMounted || !this.$refs.canvas) {
      return;
    }
    this.draw(this.$refs.canvas);
  }

  private get layers() {
    return this.store.configuration ? this.store.configuration.layers : [];
  }

  private draw(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = this.store.compositionMode;

    const isReady = new Set(this.ready);

    this.imageStack.forEach(layer => {
      layer.forEach(tile => {
        if (!isReady.has(tile.url)) {
          return;
        }
        ctx.drawImage(
          tile.image,
          0,
          0,
          tile.width,
          tile.height,
          tile.x,
          tile.y,
          tile.width,
          tile.height
        );
      });
    });
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
  border: 1px solid black;
}
</style>
