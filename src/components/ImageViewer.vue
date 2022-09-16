<template>
  <div class="image">
    <annotation-viewer
      v-if="annotationLayer"
      :annotationLayer="annotationLayer"
      :workerPreviewFeature="workerPreviewFeature"
      :unrollH="unrollH"
      :unrollW="unrollW"
      :tileWidth="tileWidth"
      :tileHeight="tileHeight"
    ></annotation-viewer>
    <div id="map" ref="geojsmap" :data-update="reactiveDraw" />
    <div class="loading" v-if="!fullyReady">
      <v-progress-circular indeterminate />
    </div>
    <div
      class="loading"
      v-if="
        fullyReady && cacheProgress > 0 && cacheProgress < cacheProgressTotal
      "
    >
      <v-progress-linear
        :value="(100 * cacheProgress) / cacheProgressTotal"
        color="#CCC"
        background-color="blue-grey"
        style="width: 200px; height: 20px"
      >
        <template v-slot:default>
          <strong>
            {{ ((100 * cacheProgress) / cacheProgressTotal).toFixed(1) }}%
            cached
          </strong>
        </template>
      </v-progress-linear>
    </div>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="0"
      height="0"
      style="position: absolute; top: -1px; left: -1px"
    >
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
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";
import geojs from "geojs";

import { IImage } from "../store/model";
import setFrameQuad from "../utils/setFrameQuad.js";

import AnnotationViewer from "@/components/AnnotationViewer.vue";

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

    const slope = `${levelP / (wpP - bpP)}`;
    const intercept = `${-(levelP * bpP) / (wpP - bpP)}`;
    if (slope != el.getAttribute("slope")) {
      el.setAttribute("slope", slope);
    }
    if (intercept != el.getAttribute("intercept")) {
      el.setAttribute("intercept", intercept);
    }
  };

  const scalePoint = (val: number, mode: string) =>
    mode === "absolute" ? (val - hist.min) / (hist.max - hist.min) : val / 100;

  const whitePoint = scalePoint(contrast.whitePoint, contrast.mode);
  const blackPoint = scalePoint(contrast.blackPoint, contrast.mode);

  setSlopeIntercept(index, "func-r", whitePoint, blackPoint, red);
  setSlopeIntercept(index, "func-g", whitePoint, blackPoint, green);
  setSlopeIntercept(index, "func-b", whitePoint, blackPoint, blue);
}

@Component({ components: { AnnotationViewer } })
export default class ImageViewer extends Vue {
  readonly store = store;

  private refsMounted = false;

  private ready = { layers: [] };

  private imageLayers: any[] = [];

  private layerParams: any;
  private map: any;
  private annotationLayer: any = null;
  private workerPreviewLayer: any = null;
  private workerPreviewFeature: any = null;
  tileWidth: number = 0;
  tileHeight: number = 0;

  private uiLayer: any;
  private scaleWidget: any;
  private unrollW: number = 1;
  private unrollH: number = 1;

  cacheProgress = 0; // 0 to cacheProgressTotal
  cacheProgressTotal = 0;

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

  private draw(mapElement: HTMLElement) {
    if ((this.width == this.height && this.width == 1) || !this.dataset) {
      return;
    }
    if (!this.layerStackImages.length) {
      return;
    }
    const someImages = this.layerStackImages.find((lsi: any) => lsi.images[0]);
    if (!someImages) {
      return;
    }
    let unrollCount = someImages.images.length;
    const someImage = someImages.images[0];
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
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;

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
    params.layer.nearestPixel = params.layer.maxLevel;
    delete params.layer.tilesMaxBounds;
    params.layer.url =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQIHWNgYAAAAAMAAU9ICq8AAAAASUVORK5CYII=";
    params.map.max += 5;
    this.layerParams = params.layer;
    if (!this.map) {
      this.map = geojs.map(params.map);
      /* remove default key bindings */
      let interactorOpts = this.map.interactor().options();
      const actions = interactorOpts.keyboard.actions;
      /* We can keep some actions, if wanted */
      interactorOpts.keyboard.actions = {'rotate.0': actions['rotate.0']};
      this.map.interactor().options(interactorOpts);
      Vue.prototype.$currentMap = this.map;
      this.annotationLayer = this.map.createLayer("annotation", {
        annotations: geojs.listAnnotations(),
        autoshareRenderer: false,
        continuousCloseProximity: true
      });
      this.workerPreviewLayer = this.map.createLayer("feature", {
        features: ["quad", "quad.image"]
      });
      this.workerPreviewFeature = this.workerPreviewLayer.createFeature("quad");

      this.annotationLayer.node().css({ "mix-blend-mode": "unset" });
      this.workerPreviewLayer.node().css({ "mix-blend-mode": "unset" });
      this.uiLayer = this.map.createLayer("ui");
      this.uiLayer.node().css({ "mix-blend-mode": "unset" });
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
      mapnode.height() != this.map.size().height
    ) {
      this.map.size({ width: mapnode.width(), height: mapnode.height() });
    }
    // adjust number of tile layers
    while (this.imageLayers.length > this.layerStackImages.length * 2) {
      this.map.deleteLayer(this.imageLayers.pop());
    }
    this.unrollW = unrollW;
    this.unrollH = unrollH;
    if (
      this.scaleWidget &&
      !(
        someImage.mm_x ||
        this.scaleWidget.options("scale") !== someImage.mm_x / 1000
      )
    ) {
      this.uiLayer.deleteWidget(this.scaleWidget);
      this.scaleWidget = null;
    }
    if (someImage.mm_x && !this.scaleWidget) {
      this.scaleWidget = this.uiLayer.createWidget("scale", {
        scale: someImage.mm_x / 1000,
        position: { bottom: 20, right: 10 }
      });
    }
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
      if (this.imageLayers.length) {
        this.layerParams.queue = this.imageLayers[0].queue;
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
    if (
      this.workerPreviewLayer.zIndex() !== this.layerStackImages.length * 2 ||
      this.annotationLayer.zIndex() !== this.layerStackImages.length * 2 + 1 ||
      this.uiLayer.zIndex() !== this.layerStackImages.length * 2 + 2
    ) {
      this.workerPreviewLayer.moveToTop();
      this.annotationLayer.moveToTop();
      this.uiLayer.moveToTop();
    }
    // set tile urls
    this.layerStackImages.forEach(
      (
        {
          layer,
          urls,
          fullUrls,
          hist,
          singleFrame,
          baseQuadOptions
        }: {
          layer: any;
          urls: string[];
          fullUrls: string[];
          hist: any;
          singleFrame: number | null;
          baseQuadOptions: any;
        },
        layerIndex: number
      ) => {
        let fullLayer = this.imageLayers[layerIndex * 2];
        let adjLayer = this.imageLayers[layerIndex * 2 + 1];
        // set fullLayer's transform
        if (!fullUrls[0] || !urls[0]) {
          if (singleFrame !== null && fullLayer.setFrameQuad) {
            fullLayer.setFrameQuad(singleFrame);
            fullLayer.visible(true);
            fullLayer
              .node()
              .css("visibility", layer.visible ? "visible" : "hidden");
            adjLayer.node().css("visibility", "hidden");
          } else {
            fullLayer.visible(false);
          }
          adjLayer.visible(false);
          adjLayer.node().css("visibility", "hidden");
          Vue.set(this.ready.layers, layerIndex, true);
          return;
        }
        generateFilterURL(layerIndex, layer.contrast, layer.color, hist);
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
          // or max-merge
          if (fullUrls.length !== 1 || singleFrame === null) {
            fullLayer.baseQuad = null;
          } else {
            if (!fullLayer.setFrameQuad) {
              setFrameQuad(someImage.tileinfo, fullLayer, {
                ...baseQuadOptions,
                progress: (status: any) => {
                  if (status.loadedCount === 0) {
                    this.cacheProgressTotal += status.images.length;
                  } else if (this.cacheProgress < this.cacheProgressTotal) {
                    this.cacheProgress += 1;
                  }
                }
              });
            }
            fullLayer.setFrameQuad(singleFrame);
          }
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
        const idle = adjLayer.idle;
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
    /* Disable running cacneWhenIdle; it doesn't help much now that we have
     * tile frame previews
    this.map.onIdle(this.cacheWhenIdle);
     */
  }

  beforeDestroy() {
    if (this.map) {
      this.map.exit();
      this.map = null;
    }
  }

  private recentCacheUrls: { [key: string]: number } = {};

  cacheWhenIdle() {
    if (
      !this.fullyReady ||
      !this.dataset ||
      !this.map ||
      !this.map.idle ||
      !this.store.configuration
    ) {
      this.cacheProgress = 0;
      return;
    }
    let zxy: { [key: string]: any } = {};
    for (
      let layerIndex = 1;
      layerIndex < this.imageLayers.length;
      layerIndex += 2
    ) {
      let adjLayer = this.imageLayers[layerIndex];
      Object.keys(adjLayer._activeTiles).forEach((tileHash: string) => {
        if (!zxy[tileHash]) {
          zxy[tileHash] = tileHash.split("_");
        }
      });
    }
    let axis: string | undefined;
    if (
      this.dataset.z.length > 1 &&
      this.dataset.z.length >= this.dataset.xy.length &&
      this.dataset.z.length >= this.dataset.time.length
    ) {
      axis = "z";
    } else if (
      this.dataset.time.length > 1 &&
      this.dataset.time.length >= this.dataset.xy.length
    ) {
      axis = "time";
    } else if (this.dataset.xy.length > 1) {
      axis = "xy";
    } else {
      // only one frame, so no need to buffer others
      this.cacheProgress = 0;
      return;
    }
    if (
      Object.keys(this.recentCacheUrls).length >
      Math.max(
        5000,
        Object.keys(zxy).length *
          (this.dataset as any)[axis].length *
          this.store.configuration.view.layers.length *
          4
      )
    ) {
      this.recentCacheUrls = {};
    }
    let urlList: string[] = [];
    let fullUrlList: string[] = [];
    let neededHistograms: IImage[][] = [];
    let maxPromises = 3;
    let addedPromises = 0;
    let cacheProgressTotal =
      (this.dataset as any)[axis].length *
      (1 + 2 * Object.keys(zxy).length) *
      this.store.configuration.view.layers.length;
    let cacheProgress = cacheProgressTotal;
    for (let idx = 0; idx < (this.dataset as any)[axis].length; idx += 1) {
      if (idx === (this.store as any)[axis]) {
        continue;
      }
      let imageList = this.store.getFullLayerImages(
        axis === "time" ? this.dataset[axis][idx] : this.store.time,
        axis === "xy" ? this.dataset[axis][idx] : this.store.xy,
        axis === "z" ? this.dataset[axis][idx] : this.store.z
      );
      neededHistograms = neededHistograms.concat(imageList.neededHistograms);
      if (imageList.neededHistograms.length) {
        cacheProgress = Math.min(
          cacheProgress,
          (idx + 1) * this.store.configuration.view.layers.length -
            neededHistograms.length
        );
      }
      if (neededHistograms.length >= maxPromises) {
        break;
      }
      if (fullUrlList.length < maxPromises) {
        imageList.fullUrls.forEach(urlTemplate => {
          Object.values(zxy).forEach(tile => {
            let url = urlTemplate
              .replace("{z}", tile[0])
              .replace("{x}", tile[1])
              .replace("{y}", tile[2]);
            if (this.recentCacheUrls[url]) {
              return;
            }
            fullUrlList.push(url);
          });
        });
        if (fullUrlList.length) {
          cacheProgress =
            Math.min(
              cacheProgress,
              (idx + 1) *
                this.store.configuration.view.layers.length *
                Object.keys(zxy).length -
                fullUrlList.length
            ) +
            (this.dataset as any)[axis].length *
              this.store.configuration.view.layers.length;
        }
      }
      if (urlList.length < maxPromises) {
        imageList.urls.forEach(urlTemplate => {
          Object.values(zxy).forEach(tile => {
            let url = urlTemplate
              .replace("{z}", tile[0])
              .replace("{x}", tile[1])
              .replace("{y}", tile[2]);
            if (this.recentCacheUrls[url]) {
              return;
            }
            urlList.push(url);
          });
        });
        if (urlList.length) {
          cacheProgress =
            Math.min(
              cacheProgress,
              (idx + 1) *
                this.store.configuration.view.layers.length *
                Object.keys(zxy).length -
                urlList.length
            ) +
            (this.dataset as any)[axis].length *
              (1 + Object.keys(zxy).length) *
              this.store.configuration.view.layers.length;
        }
      }
    }
    if (neededHistograms.length || fullUrlList.length || urlList.length) {
      this.cacheProgress = cacheProgress;
    } else {
      this.cacheProgress = cacheProgressTotal;
    }
    this.cacheProgressTotal = cacheProgressTotal;
    // first prefetch any needed histograms
    neededHistograms.forEach(images => {
      if (addedPromises < maxPromises) {
        this.map.addPromise(this.store.api.getLayerHistogram(images));
        addedPromises += 1;
      }
    });
    // load the first tile we haven't seen in a while
    urlList = fullUrlList.concat(urlList);
    urlList.forEach(url => {
      if (addedPromises < maxPromises) {
        this.map.addPromise(
          new Promise((resolve: any, reject: any) => {
            let img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
            this.recentCacheUrls[url] = Date.now();
          })
        );
        addedPromises += 1;
      }
    });
    if (addedPromises) {
      this.map.onIdle(this.cacheWhenIdle);
    }
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
  font-size: 12px;
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
