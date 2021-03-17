<template>
  <div class="image">
    <div id="map" ref="geojsmap" :data-update="reactiveDraw" />
    <div class="loading" v-if="!fullyReady">
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
) {
  if (hist === null) {
    return;
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

  private ready = { layers: [] };

  private imageLayers: any[] = [];

  private layerParams: any;
  private map: any;
  private annotationLayer: any;
  private unrollW: number = 1;
  private unrollH: number = 1;

  $refs!: {
    geojsmap: HTMLElement;
  };

  get fullyReady() {
    return this.ready.layers.every(d => d);
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

  get annotationStyle(): any {
    const mode = this.store.annotationMode;
    const list = this.store.annotationModeList.filter(
      entry => entry.key === mode
    );
    return list.length ? list[0] : null;
  }

  @Watch("annotationStyle")
  watchAnnotationStyle(value: any | null) {
    if (this.annotationLayer) {
      this.annotationLayer.mode(value ? value.mode : null);
    }
  }

  handleModeChange(evt: any) {
    if (evt.mode === null && this.store.annotationMode !== null) {
      // we could, instead, just deactive the button
      // this.store.setAnnotationMode(evt.mode);
      this.annotationLayer.mode(this.annotationStyle.mode);
    }
  }

  handleAnnotationChange(evt: any) {
    if (this.annotationStyle && evt.annotation) {
      evt.annotation.style(this.annotationStyle.style);
    }
  }

  private draw(mapElement: HTMLElement) {
    if ((this.width == this.height && this.width == 1) || !this.dataset) {
      return;
    }
    if (!this.layerStackImages.length) {
      return;
    }
    let unrollCount = this.layerStackImages[0].images.length;
    const someImage = this.layerStackImages[0].images[0];
    let unrollW = Math.min(
      unrollCount,
      Math.ceil(
        Math.sqrt(someImage.sizeX * someImage.sizeY * unrollCount) /
          someImage.sizeX
      )
    );
    let unrollH = Math.ceil(unrollCount / unrollW);
    let mapWidth = unrollW * someImage.sizeX;
    let mapHeight = unrollH * someImage.sizeY;
    let adjustLayers = true;
    let tileWidth = someImage.tileWidth;
    let tileHeight = someImage.tileHeight;
    let params = geojs.util.pixelCoordinateParams(
      mapElement,
      someImage.sizeX,
      someImage.sizeY,
      tileWidth,
      tileHeight
    );
    params.map.maxBounds.right = mapWidth;
    params.map.maxBounds.bottom = mapHeight;
    params.map.min -= Math.ceil(
      Math.log(Math.max(unrollW, unrollH)) / Math.log(2)
    );
    params.map.zoom = params.map.min;
    params.map.center = { x: mapWidth / 2, y: mapHeight / 2 };
    params.layer.useCredentials = true;
    params.layer.autoshareRenderer = false;
    delete params.layer.tilesMaxBounds;
    params.layer.url =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQIHWNgYAAAAAMAAU9ICq8AAAAASUVORK5CYII=";
    params.map.max += 1;
    this.layerParams = params.layer;
    if (!this.map) {
      this.map = geojs.map(params.map);
      Vue.prototype.$currentMap = this.map;
      this.annotationLayer = this.map.createLayer("annotation", {
        annotations: geojs.listAnnotations(),
        autoshareRenderer: false
      });
      this.annotationLayer.node().css({ "mix-blend-mode": "unset" });
      this.annotationLayer.geoOn(
        geojs.event.annotation.mode,
        this.handleModeChange
      );
      this.annotationLayer.geoOn(
        geojs.event.annotation.add,
        this.handleAnnotationChange
      );
    } else {
      adjustLayers =
        Math.abs(this.map.maxBounds(undefined, null).right - mapWidth) >= 0.5 ||
        Math.abs(this.map.maxBounds(undefined, null).bottom - mapHeight) >= 0.5;
      if (adjustLayers) {
        this.map.maxBounds({
          left: 0,
          top: 0,
          right: params.map.maxBounds.right,
          bottom: params.map.maxBounds.bottom
        });
        this.map.zoomRange(params.map);
      }
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
    this.unrollW = unrollW;
    this.unrollH = unrollH;
    while (this.imageLayers.length < this.layerStackImages.length * 2) {
      this.layerParams.tilesAtZoom = (level: number) => {
        const s = Math.pow(2, someImage.levels - 1 - level);
        const result = {
          x:
            Math.ceil(someImage.sizeX / s / someImage.tileWidth) * this.unrollW,
          y:
            Math.ceil(someImage.sizeY / s / someImage.tileHeight) * this.unrollH
        };
        return result;
      };
      if (this.imageLayers.length >= 12) {
        this.layerParams.renderer = "canvas";
      } else {
        delete this.layerParams.renderer;
      }
      this.imageLayers.push(this.map.createLayer("osm", this.layerParams));
      let layer = this.imageLayers[this.imageLayers.length - 1];
      if (this.imageLayers.length & 1) {
        const index = (this.imageLayers.length - 1) / 2;
        layer.node().css("filter", `url(#recolor-${index})`);
      }
      layer.url((x: number, y: number, level: number) => {
        const s = Math.pow(2, someImage.levels - 1 - level);
        const txy = {
          x: Math.ceil(someImage.sizeX / s / someImage.tileWidth),
          y: Math.ceil(someImage.sizeY / s / someImage.tileHeight)
        };
        const imageNum =
          Math.floor(x / txy.x) + Math.floor(y / txy.y) * this.unrollW;
        if (!layer._imageUrls || !layer._imageUrls[imageNum]) {
          return params.layer.url;
        }
        const tx = x % txy.x;
        const ty = y % txy.y;
        const result = layer._imageUrls[imageNum]
          .replace("{z}", level)
          .replace("{x}", tx)
          .replace("{y}", ty);
        return result;
      });
      const o = layer._tileBounds;
      layer._tileBounds = (tile: any) => {
        const s = Math.pow(2, someImage.levels - 1 - tile.index.level);
        const w = Math.ceil(someImage.sizeX / s),
          h = Math.ceil(someImage.sizeY / s);
        const txy = {
          x: Math.ceil(someImage.sizeX / s / someImage.tileWidth),
          y: Math.ceil(someImage.sizeY / s / someImage.tileHeight)
        };
        const imagexy = {
          x: Math.floor(tile.index.x / txy.x),
          y: Math.floor(tile.index.y / txy.y)
        };
        const tilexy = {
          x: tile.index.x % txy.x,
          y: tile.index.y % txy.y
        };
        const result = {
          left: tilexy.x * tile.size.x + w * imagexy.x,
          top: tilexy.y * tile.size.y + h * imagexy.y,
          right: Math.min((tilexy.x + 1) * tile.size.x, w) + w * imagexy.x,
          bottom: Math.min((tilexy.y + 1) * tile.size.y, h) + h * imagexy.y
        };
        return result;
      };
      layer.tileAtPoint = (point: any, level: number) => {
        point = layer.displayToLevel(
          layer.map().gcsToDisplay(point, null),
          someImage.levels - 1
        );
        const s = Math.pow(2, someImage.levels - 1 - level);
        const x = point.x,
          y = point.y;
        const txy = {
          x: Math.ceil(someImage.sizeX / s / someImage.tileWidth),
          y: Math.ceil(someImage.sizeY / s / someImage.tileHeight)
        };
        const result = {
          x:
            Math.floor(x / someImage.sizeX) * txy.x +
            Math.floor(
              (x - Math.floor(x / someImage.sizeX) * someImage.sizeX) /
                someImage.tileWidth /
                s
            ),
          y:
            Math.floor(y / someImage.sizeY) * txy.y +
            Math.floor(
              (y - Math.floor(y / someImage.sizeY) * someImage.sizeY) /
                someImage.tileHeight /
                s
            )
        };
        return result;
      };
    }
    this.ready.layers.splice(this.layerStackImages.length);
    this.annotationLayer.moveToTop();
    // set tile urls
    this.layerStackImages.forEach(
      (
        {
          layer,
          urls,
          fullUrls,
          hist
        }: { layer: any; urls: string[]; fullUrls: string[]; hist: any },
        layerIndex: number
      ) => {
        let fullLayer = this.imageLayers[layerIndex * 2];
        let adjLayer = this.imageLayers[layerIndex * 2 + 1];
        // set fullLayer's transform
        generateFilterURL(layerIndex, layer.contrast, layer.color, hist);
        if (!fullUrls[0] || !urls[0]) {
          fullLayer.visible(false);
          adjLayer.visible(false);
          Vue.set(this.ready.layers, layerIndex, true);
          return;
        }
        fullLayer.visible(true);
        adjLayer.visible(true);
        // use css visibility so that geojs will still load tiles when not
        // visible.
        if (
          !fullLayer._imageUrls ||
          fullUrls.length !== fullLayer._imageUrls.length ||
          fullUrls.some((url, idx) => url !== fullLayer._imageUrls[idx])
        ) {
          fullLayer._imageUrls = fullUrls;
          fullLayer.reset();
        }
        if (
          !adjLayer._imageUrls ||
          urls.length !== adjLayer._imageUrls.length ||
          urls.some((url, idx) => url !== adjLayer._imageUrls[idx])
        ) {
          adjLayer._imageUrls = urls;
          adjLayer.reset();
          adjLayer.map().draw();
          adjLayer.onIdle(() => {
            if (
              fullUrls.every((url, idx) => url === fullLayer._imageUrls[idx]) &&
              urls.every((url, idx) => url === adjLayer._imageUrls[idx])
            ) {
              fullLayer.node().css("visibility", "hidden");
              adjLayer
                .node()
                .css("visibility", layer.visible ? "visible" : "hidden");
              Vue.set(this.ready.layers, layerIndex, true);
            }
          });
        }
        const idle = /* fullLayer.idle && */ adjLayer.idle;
        fullLayer
          .node()
          .css("visibility", !idle && layer.visible ? "visible" : "hidden");
        adjLayer
          .node()
          .css("visibility", idle && layer.visible ? "visible" : "hidden");
        Vue.set(this.ready.layers, layerIndex, idle);
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
.loading {
  color: white;
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
