<template>
  <div class="image">
    <div id="map" ref="geojsmap" :data-update="reactiveDraw" />
    <div class="loading" v-if="fullyReady">
      <v-progress-circular indeterminate />
    </div>
    <svg xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter
          :id="'recolor-' + index"
          color-interpolation-filters="sRGB"
          v-for="(item, index) in imageLayers"
          :key="'recolor-' + index"
        >
          <feComponentTransfer>
            <feFuncR class="func-r" type="linear" slope="0" intercept="0" />
            <feFuncG class="func-g" type="linear" slope="0" intercept="0" />
            <feFuncB class="func-b" type="linear" slope="0" intercept="0" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  </div>
</template>
<script lang="ts">
// in cosole debugging, you can access the map via
//  $('.geojs-map').data('data-geojs-map')
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
  index: number,
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
    index: number,
    id: string,
    wp: number,
    bp: number,
    level: number
  ) => {
    const el = document.querySelector(`#recolor-${index} .${id}`);
    if (!el) {
      return;
    }

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

  setSlopeIntercept(index, "func-r", whitePoint, blackPoint, red);
  setSlopeIntercept(index, "func-g", whitePoint, blackPoint, green);
  setSlopeIntercept(index, "func-b", whitePoint, blackPoint, blue);
}

@Component
export default class ImageViewer extends Vue {
  readonly store = store;

  private refsMounted = false;

  private ready: string[] = [];

  private imageLayers = [];

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
      params.layer.url =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==";
      params.map.max += 1;
      this.map = geojs.map(params.map);
      this.layerParams = params.layer;
      // TODO: add annotation layer
    }
    const mapnode = this.map.node();
    if (
      mapnode.width() != this.map.size().width ||
      mapnode.height() != this.map.size.height
    ) {
      this.map.size({ width: mapnode.width(), height: mapnode.height() });
    }
    // adjust number of tile layers
    while (this.imageLayers.length > this.layerStackImages.length * 2) {
      this.map.deleteLayer(this.imageLayers.pop());
    }
    while (this.imageLayers.length < this.layerStackImages.length * 2) {
      if (this.imageLayers.length >= 12) {
        this.layerParams.renderer = "canvas";
      } else {
        delete this.layerParams.renderer;
      }
      this.imageLayers.push(this.map.createLayer("osm", this.layerParams));
      if (this.imageLayers.length & 1) {
        const index = (this.imageLayers.length - 1) / 2;
        this.imageLayers[this.imageLayers.length - 1]
          .node()
          .css("filter", `url(#recolor-${index})`);
      }
    }
    // set tile urls
    this.layerStackImages.forEach(
      ({ layer, images, urls, fullUrls, hist }, layerIndex) => {
        let fullLayer = this.imageLayers[layerIndex * 2];
        let adjLayer = this.imageLayers[layerIndex * 2 + 1];
        // set fullLayer's transform
        generateFilterURL(layerIndex, layer.contrast, layer.color, hist);
        // TODO: add multiple tile sources when compositing multiple images
        if (!fullUrls[0] || !urls[0]) {
          fullLayer.visible(false);
          adjLayer.visible(false);
          return;
        }
        fullLayer.visible(true);
        adjLayer.visible(true);
        // use css visibility so that geojs will still load tiles when not
        // viisble.
        if (fullUrls[0] !== fullLayer.url() || urls[0] != adjLayer.url()) {
          fullLayer
            .url(fullUrls[0])
            .node()
            .css("visibility", layer.visible ? "visible" : "hidden");
          adjLayer
            .url(urls[0])
            .node()
            .css("visibility", "hidden");
          adjLayer.onIdle(() => {
            if (fullLayer.url() == fullUrls[0] && adjLayer.url() == urls[0]) {
              fullLayer.node().css("visibility", "hidden");
              adjLayer
                .node()
                .css("visibility", layer.visible ? "visible" : "hidden");
            }
          });
        } else {
          const idle = fullLayer.idle && adjLayer.idle;
          fullLayer
            .node()
            .css("visibility", !idle && layer.visible ? "visible" : "hidden");
          adjLayer
            .node()
            .css("visibility", idle && layer.visible ? "visible" : "hidden");
        }
      }
    );
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
