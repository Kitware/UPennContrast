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
    <svg xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="recolor">
          <feComponentTransfer>
            <feFuncR id="func-r" type="linear" slope="0" intercept="0" />
            <feFuncG id="func-g" type="linear" slope="0" intercept="0" />
            <feFuncB id="func-b" type="linear" slope="0" intercept="0" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
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

function generateFilterURL(
  contrast: { whitePoint: number; blackPoint: number; mode: string },
  color: string,
  hist: { min: number; max: number }
): string {
  // Tease out the RGB color levels.
  const toVal = (s: string) => parseInt(`0x${s}`);
  const red = toVal(color.slice(1, 3));
  const green = toVal(color.slice(3, 5));
  const blue = toVal(color.slice(5, 7));

  const setSlopeIntercept = (
    id: string,
    wp: number,
    bp: number,
    level: number
  ) => {
    const el = document.getElementById(id)!;

    const levelP = level / 255;
    const wpP = wp;
    const bpP = bp;

    el.setAttribute("slope", `${levelP / (wpP - bpP)}`);
    el.setAttribute("intercept", `${-(levelP * bpP) / (wpP - bpP)}`);
  };

  const scalePoint = (val: number, mode: string) =>
    mode === "absolute" ? (val - hist.min) / (hist.max - hist.min) : val / 100;

  const whitePoint = scalePoint(contrast.whitePoint, contrast.mode);
  const blackPoint = scalePoint(contrast.blackPoint, contrast.mode);

  setSlopeIntercept("func-r", whitePoint, blackPoint, red);
  setSlopeIntercept("func-g", whitePoint, blackPoint, green);
  setSlopeIntercept("func-b", whitePoint, blackPoint, blue);

  return "#recolor";
}

@Component
export default class ImageViewer extends Vue {
  readonly store = store;

  private refsMounted = false;
  private transform = Object.assign({}, zoomIdentity);

  private containerDimensions = { width: 100, height: 100 };

  private imageDataStack: IImageTile[][] = [];

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
    const urls = this.imageStack.reduce<string[]>(
      (acc, d) => acc.concat(d.map(i => i.url)),
      []
    );
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

  get layerStack() {
    return this.store.layerStack;
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
          tile.image.onload = event => {
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
    ctx.globalCompositeOperation = this.store.compositionMode;

    const isReady = new Set(this.ready);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let stack = this.imageDataStack;
    const layers = this.layerStack;
    this.imageStack.forEach((layer, layerIndex) => {
      layer.forEach((tile, tileIndex) => {
        if (!isReady.has(tile.url)) {
          if (
            stack.length > layerIndex &&
            stack[layerIndex][tileIndex] !== undefined
          ) {
            const oldTile = stack[layerIndex][tileIndex];
            const layerConfig = layers[layerIndex];
            console.log(layerConfig);
            const filterURL = generateFilterURL(
              layerConfig.contrast,
              layerConfig.color,
              layerConfig._histogram.last
            );
            ctx.filter = `url(${filterURL})`;
            ctx.drawImage(
              oldTile.image,
              0,
              0,
              oldTile.width,
              oldTile.height,
              oldTile.x,
              oldTile.y,
              oldTile.width,
              oldTile.height
            );
            ctx.filter = "none";
          }
          return;
        }

        if (stack.length <= layerIndex) {
          stack[layerIndex] = [];
        }

        stack[layerIndex][tileIndex] = tile;

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

  private drawShadow(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d")!;

    const image2 = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const image = new ImageData(
      Uint8ClampedArray.from(image2.data),
      canvas.width,
      canvas.height
    );

    let d = image.data;
    for (let i = 0; i < canvas.height; i++) {
      for (let j = 0; j < canvas.width; j++) {
        const idx = 4 * (i * canvas.width + j);
        for (let k = 0; k < 1; k++) {
          d[idx + k] = 255 - d[idx + k];
          // d[idx + k] = Math.random() * 255;
        }
        // d[idx + 3] = 255;
      }
    }

    // ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(image, 0, 0);

    // ctx.beginPath();
    // ctx.rect(20, 20, canvas.width / 2, canvas.height / 3);
    // ctx.fillStyle = "red";
    // ctx.fill();
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
