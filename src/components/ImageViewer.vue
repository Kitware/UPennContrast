<template>
  <div class="image">
    <div
      id="map"
      ref="geojsmap"
      :data-update="reactiveDraw"
    />
    <div class="loading" v-if="fullyReady">
      <v-progress-circular indeterminate />
    </div>
    <svg xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="recolor" color-interpolation-filters="sRGB">
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
import geojs from "geojs";
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
  if (hist === null) {
    return "";
  }
  // Tease out the RGB color levels.
  const toVal = (s: string) => parseInt(`0x${s}`) / 255;

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

    const levelP = level;
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

  private ready: string[] = [];

  $refs!: {
    geojsmap: HTMLElement;
  };

  get fullyReady() {
    return !this.map || this.map.idle();
  }

  get dataset() {
    return this.store.dataset;
  }

  get width() {
    return this.store.dataset ? this.store.dataset.width : 1;
  }

  get height() {
    return this.store.dataset ? this.store.dataset.height : 1;
  }

  mounted() {
    this.refsMounted = true;
  }

  get reactiveDraw() {
    if (!this.refsMounted || !this.$refs.geojsmap) {
      return;
    }
    this.draw(this.$refs.geojsmap);
  }

  private get layerStackImages() {
    return this.store.configuration ? this.store.layerStackImages : [];
  }

  private draw(mapElement: HTMLElement) {
    if ((this.width == this.height && this.width == 1) || !this.dataset) {
      return;
    }
    if (!this.map) {
      let tileWidth = this.dataset.images(0, 0, 0, 0)[0].tileWidth;
      let tileHeight = this.dataset.images(0, 0, 0, 0)[0].tileHeight;
      let params = geojs.util.pixelCoordinateParams(
        mapElement,
        this.width,
        this.height,
        tileWidth,
        tileHeight
      );
      params.layer.useCredentials = true;
      params.layer.autoshareRenderer = false;
      params.map.max += 1;
      this.map = geojs.map(params.map);
      this.layerParams = params.layer;
      this.imageLayers = [];
      // TODO: add annotation layer
    }
    const mapnode = this.map.node();
    if (mapnode.width() != this.map.size().width || mapnode.height() != this.map.size.height) {
      this.map.size({ width: mapnode.width(), height: mapnode.height() });
    }
    this.layerStackImages.forEach(({layer, images, urls, fullUrls}, layerIndex) => {
      while (this.imageLayers.length < (layerIndex + 1) * 2) {
        if (this.imageLayers.length >= 12) {
          this.layerParams.renderer = 'canvas';
        } else {
          delete this.layerParams.renderer;
        }
        this.imageLayers.push(this.map.createLayer('osm', this.layerParams));
      }
      // TODO: add multiple tile sources when compositing multiple images
      let fullLayer = this.imageLayers[layerIndex * 2];
      let adjLayer = this.imageLayers[layerIndex * 2 + 1];
      if (!fullUrls[0] || !urls[0]) {
        fullLayer.visible(false);
        adjLayer.visible(false);
        return;
      }
      fullLayer.url(fullUrls[0]).visible(false);
      adjLayer.url(urls[0]).visible(layer.visible);
    });
    while (this.imageLayers.length > this.layerStackImages.length * 2) {
      this.map.deleteLayer(this.imageLayers.pop());
    }
    this.map.draw();
  }
}
</script>

<style lang="scss" scoped>
.image {
  position: relative;
  overflow: hidden;
}
.geojs-map {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: black;
}
</style>
<style lang="scss">
.geojs-map .geojs-layer {
  mix-blend-mode: lighten;
}
</style>
