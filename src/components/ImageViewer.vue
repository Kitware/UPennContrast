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
    <div class="loading" v-if="readyPercentage < 100">
      <v-progress-circular indeterminate />
    </div>
  </div>
</template>
<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import { select, event as d3Event } from "d3-selection";
import {
  zoom as d3Zoom,
  D3ZoomEvent,
  zoomIdentity,
  zoomTransform
} from "d3-zoom";
import { IImageTile } from "../store/model";

@Component
export default class ImageViewer extends Vue {
  readonly store = store;

  private refsMounted = false;
  private transform = Object.assign({}, zoomIdentity);

  private containerDimensions = { width: 100, height: 100 };

  readonly zoom = d3Zoom<HTMLElement, any>()
    .on("zoom", () => {
      this.zoomed(d3Event as D3ZoomEvent<HTMLElement, any>);
    })
    .on("start", function(this: HTMLElement) {
      const event = (d3Event as D3ZoomEvent<HTMLElement, any>).sourceEvent;
      if (event && event.type === "wheel") {
        this.classList.add(event.wheelDelta > 0 ? "zoomIn" : "zoomOut");
      } else {
        this.classList.add("grabbing");
      }
    })
    .on("end", function(this: HTMLElement) {
      this.classList.remove("grabbing", "zoomIn", "zoomOut");
    });

  private ready: string[] = [];

  $refs!: {
    canvas: HTMLCanvasElement;
  };

  get cssTransform() {
    return `translate(${this.transform.x}px, ${this.transform.y}px) scale(${this.transform.k})`;
  }

  get readyPercentage() {
    const total = this.imageStack.reduce((acc, d) => acc + d.length, 0);
    const urls = this.imageStack.reduce<string[]>((acc, d) => acc.concat(d.map(i => i.url)), []);
    const loaded = this.ready.filter(u => urls.indexOf(u) >= 0).length;
    return Math.round((100.0 * loaded) / total);
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
    this.ready = [];
    value.forEach(layer => {
      layer.forEach(tile => {
        if (tile.image.src && tile.image.complete) {
          this.ready.push(tile.url);
        } else {
          const tileImage = tile.image;
          const previousOnload = tileImage.onload;
          tile.image.onload = (event) => {
            // not just loaded but also decoded
            tile.image.decode().then(() => {
              this.ready.push(tile.url);
            });
            if (previousOnload) {
              previousOnload.call(tileImage, event);
            }
          };
        }
      });
    });
  }

  @Watch("width")
  watchWidth() {
    this.$nextTick(() => this.centerZoom());
  }

  @Watch("height")
  watchHeight() {
    this.$nextTick(() => this.centerZoom());
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
    this.centerZoom();
  }

  private d3Element() {
    return select(this.$el as HTMLElement);
  }

  private initZoom() {
    this.d3Element().call(this.zoom);
  }

  private centerZoom() {
    const cw = this.containerDimensions.width;
    const ch = this.containerDimensions.height;

    // transform image such that it is in the center maybe even scaled
    const k = Math.min(cw / this.width, ch / this.height, 1);
    const x = (cw - this.width * k) / 2;
    const y = (ch - this.height * k) / 2;

    this.transform = zoomIdentity.translate(x, y).scale(k);
    this.zoom.transform(this.d3Element(), this.transform);
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
  cursor: grab;
}

.grabbing {
  cursor: grabbing;
}

.zoomIn {
  cursor: nwse-resize;
  cursor: -moz-zoom-in;
  cursor: -webkit-zoom-in;
}

.zoomOut {
  cursor: nwse-resize;
  cursor: -moz-zoom-out;
  cursor: -webkit-zoom-out;
}

.loading {
  position: absolute;
  top: 0;
  right: 0;
}

.canvas {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  border: 1px solid black;
}
</style>
