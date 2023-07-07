<template>
  <div class="image" v-mousetrap="mousetrapAnnotations">
    <annotation-viewer
      v-for="(mapentry, index) in maps.filter(
        mapentry =>
          mapentry.annotationLayer &&
          mapentry.lowestLayer !== undefined &&
          mapentry.imageLayers &&
          mapentry.imageLayers.length
      )"
      :annotationLayer="mapentry.annotationLayer"
      :textLayer="mapentry.textLayer"
      :workerPreviewFeature="mapentry.workerPreviewFeature"
      :maps="maps"
      :unrollH="unrollH"
      :unrollW="unrollW"
      :tileWidth="tileWidth"
      :tileHeight="tileHeight"
      :lowestLayer="mapentry.lowestLayer || 0"
      :layerCount="(mapentry.imageLayers || []).length / 2"
      :key="'annotation-viewer-' + index"
    ></annotation-viewer>
    <div
      class="map-layout"
      ref="geojsmap"
      :data-update="reactiveDraw"
      :map-count="mapLayerList.length"
    >
      <div
        v-for="(item, index) in mapLayerList"
        :id="'map-' + index"
        :key="'geojsmap-' + index"
      />
    </div>
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
          v-for="(item, index) in layerStackImages"
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
import annotationStore from "@/store/annotation";
import store from "@/store";
import geojs from "geojs";

import { IImage, ILayerStackImage, IMapEntry } from "../store/model";
import setFrameQuad from "../utils/setFrameQuad.js";

import AnnotationViewer from "@/components/AnnotationViewer.vue";
import { ITileHistogram } from "@/store/images";

function generateFilterURL(
  index: number,
  contrast: { whitePoint: number; blackPoint: number; mode: string },
  color: string,
  hist: ITileHistogram | null
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

  // Mousetrap bindings
  readonly mousetrapAnnotations = [
    {
      bind: "a",
      handler: () => {
        this.store.setDrawAnnotations(!this.store.drawAnnotations);
      }
    },
    {
      bind: "t",
      handler: () => {
        this.store.setShowTooltips(!this.store.showTooltips);
      }
    },
    {
      bind: "mod+backspace",
      handler: () => {
        annotationStore.deleteSelectedAnnotations();
      }
    },
    {
      bind: "mod+z",
      handler: () => {
        this.store.do(true);
      }
    },
    {
      bind: "mod+shift+z",
      handler: () => {
        this.store.do(false);
      }
    }
  ];

  private refsMounted = false;

  private ready = { layers: [] };

  private resetMapsOnDraw = false;

  get maps() {
    return this.store.maps;
  }

  set maps(value: IMapEntry[]) {
    this.store.maps = value;
  }

  tileWidth: number = 0;
  tileHeight: number = 0;

  unrollW: number = 1;
  unrollH: number = 1;

  private _inPan: number | undefined = undefined;

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

  get layerStackImages() {
    return this.store.configuration ? this.store.layerStackImages : [];
  }

  get mapLayerList(): ILayerStackImage[][] {
    let llist = [this.layerStackImages];
    if (this.store.layerMode === "unroll") {
      // Bind each group id (not nullish) to a llist index
      const layerGroups: Map<string, number> = new Map();
      llist = [];
      this.layerStackImages.forEach(lsi => {
        if (lsi.layer.visible) {
          const group = lsi.layer.layerGroup;
          if (group) {
            if (!layerGroups.has(group)) {
              layerGroups.set(group, llist.length);
              llist.push([]);
            }
            const groupIdx = layerGroups.get(group)!;
            llist[groupIdx].push(lsi);
          } else {
            llist.push([lsi]);
          }
        }
      });
    }
    return llist;
  }

  /**
   * Synchronize all maps on any pan event.
   */
  private _handlePan(mapidx: number) {
    if (this._inPan !== undefined) {
      return;
    }
    if (!this.maps || this.maps.length < 2) {
      return;
    }
    this._inPan = mapidx;
    try {
      const map = this.maps[mapidx].map;
      this.maps.forEach((mapentry, idx) => {
        if (idx === mapidx) {
          return;
        }
        mapentry.map.zoom(map.zoom(), undefined, true, true);
        mapentry.map.rotation(map.rotation(), undefined, true);
        mapentry.map.center(map.center(), undefined, true, true);
      });
    } catch (err) {}
    this._inPan = undefined;
  }

  @Watch("mapLayerList")
  updateMapLayerList() {
    Vue.nextTick(() => {
      if (!this.refsMounted || !this.$refs.geojsmap) {
        return;
      }
      this.draw(this.$refs.geojsmap);
    });
  }

  private blankUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQIHWNgYAAAAAMAAU9ICq8AAAAASUVORK5CYII=";

  private _setupMap(
    mllidx: number,
    parentElement: Element,
    someImage: IImage,
    forceReset: boolean = false
  ) {
    const mapElement = parentElement.querySelector(`#map-${mllidx}`);
    if (!mapElement) {
      return;
    }
    let mapWidth = this.unrollW * someImage.sizeX;
    let mapHeight = this.unrollH * someImage.sizeY;
    let params = geojs.util.pixelCoordinateParams(
      mapElement,
      someImage.sizeX,
      someImage.sizeY,
      this.tileWidth,
      this.tileHeight
    );
    params.map.maxBounds.right = mapWidth;
    params.map.maxBounds.bottom = mapHeight;
    params.map.min -= Math.ceil(
      Math.log(Math.max(this.unrollW, this.unrollH)) / Math.log(2)
    );
    params.map.zoom = params.map.min;
    params.map.center = { x: mapWidth / 2, y: mapHeight / 2 };
    params.layer.useCredentials = true;
    params.layer.autoshareRenderer = false;
    params.layer.nearestPixel = params.layer.maxLevel;
    delete params.layer.tilesMaxBounds;
    params.layer.url = this.blankUrl;
    params.map.max += 5;

    let needReset = forceReset || (this.maps[mllidx] && !mapElement.firstChild);
    if (needReset) {
      this.maps[mllidx]?.map.exit();
    }

    let map: any;
    let mapentry: IMapEntry | undefined;
    if (this.maps.length <= mllidx || needReset) {
      map = geojs.map(params.map);
      map.geoOn(geojs.event.pan, () => this._handlePan(mllidx));
      mapentry = {
        map: map,
        imageLayers: [],
        params: params,
        baseLayerIndex: mllidx ? undefined : 0
      };
      Vue.set(this.maps, mllidx, mapentry);

      /* remove default key bindings */
      let interactorOpts = map.interactor().options();
      const actions = interactorOpts.keyboard.actions;
      /* We can keep some actions, if wanted */
      interactorOpts.keyboard.actions = { "rotate.0": actions["rotate.0"] };
      map.interactor().options(interactorOpts);
      mapentry.annotationLayer = map.createLayer("annotation", {
        annotations: geojs.listAnnotations(),
        autoshareRenderer: false,
        continuousCloseProximity: true,
        showLabels: false
      });
      mapentry.workerPreviewLayer = map.createLayer("feature", {
        renderer: mllidx ? "canvas" : undefined,
        features: ["quad", "quad.image"]
      });
      mapentry.workerPreviewFeature = mapentry.workerPreviewLayer.createFeature(
        "quad"
      );

      mapentry.annotationLayer.node().css({ "mix-blend-mode": "unset" });
      mapentry.workerPreviewLayer.node().css({ "mix-blend-mode": "unset" });
      mapentry.textLayer = map.createLayer("feature", { features: ["text"] });
      mapentry.textLayer.node().css({ "mix-blend-mode": "unset" });
    } else {
      mapentry = this.maps[mllidx];
      mapentry.params = params;
      map = mapentry.map;
      const adjustLayers =
        Math.abs(map.maxBounds(undefined, null).right - mapWidth) >= 0.5 ||
        Math.abs(map.maxBounds(undefined, null).bottom - mapHeight) >= 0.5;
      if (adjustLayers) {
        map.maxBounds({
          left: 0,
          top: 0,
          right: params.map.maxBounds.right,
          bottom: params.map.maxBounds.bottom
        });
        map.zoomRange(params.map);
      }
    }

    // only have a scale widget on the first map
    if (!mllidx) {
      if (!mapentry.uiLayer) {
        mapentry.uiLayer = map.createLayer("ui");
        mapentry.uiLayer.node().css({ "mix-blend-mode": "unset" });
      }
      if (
        mapentry.scaleWidget &&
        !(
          someImage.mm_x ||
          mapentry.scaleWidget.options("scale") !== someImage.mm_x / 1000
        )
      ) {
        mapentry.uiLayer.deleteWidget(mapentry.scaleWidget);
        mapentry.scaleWidget = null;
      }
      if (someImage.mm_x && !mapentry.scaleWidget) {
        mapentry.scaleWidget = mapentry.uiLayer.createWidget("scale", {
          scale: someImage.mm_x / 1000,
          position: { bottom: 20, right: 10 }
        });
      }
    }
  }

  /**
   * Make sure a map has the appropriate tile layers.
   */
  private _setupTileLayers(
    mll: ILayerStackImage[],
    mllidx: number,
    someImage: IImage,
    baseLayerIndex: number
  ) {
    const mapentry = this.maps[mllidx];
    const map = mapentry.map;
    // adjust number of tile layers
    while (
      mapentry.imageLayers.length > mll.length * 2 ||
      (mapentry.baseLayerIndex !== baseLayerIndex &&
        mapentry.imageLayers.length)
    ) {
      map.deleteLayer(mapentry.imageLayers.pop());
    }
    mapentry.baseLayerIndex = baseLayerIndex;
    while (mapentry.imageLayers.length < mll.length * 2) {
      mapentry.params.layer.tilesAtZoom = (level: number) => {
        const s = Math.pow(2, someImage.levels - 1 - level);
        const result = {
          x:
            Math.ceil(someImage.sizeX / s / someImage.tileWidth) * this.unrollW,
          y:
            Math.ceil(someImage.sizeY / s / someImage.tileHeight) * this.unrollH
        };
        return result;
      };
      const currentImageLayers = this.maps.reduce(
        (acc, entry) => acc + (entry.imageLayers || []).length,
        0
      );
      /* I thought the number of webgl layesr would be
       *  imageLayers (mll * 2) + 1 + this.maps.length
       * but we run out of webgl contexts sooner than that.  Maybe because they
       * get switched on and off?
       */
      if (currentImageLayers + this.maps.length >= 13) {
        mapentry.params.layer.renderer = "canvas";
      } else {
        delete mapentry.params.layer.renderer;
      }
      if (mapentry.imageLayers.length) {
        mapentry.params.layer.queue = mapentry.imageLayers[0].queue;
      }
      mapentry.imageLayers.push(map.createLayer("osm", mapentry.params.layer));
      let layer = mapentry.imageLayers[mapentry.imageLayers.length - 1];
      if (mapentry.imageLayers.length & 1) {
        const index = (mapentry.imageLayers.length - 1) / 2;
        layer.node().css("filter", `url(#recolor-${index + baseLayerIndex})`);
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
          return this.blankUrl;
        }
        const tx = x % txy.x;
        const ty = y % txy.y;
        const result = layer._imageUrls[imageNum]
          .replace("{z}", level)
          .replace("{x}", tx)
          .replace("{y}", ty);
        return result;
      });
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
  }

  /**
   * Set tile urls for all tile layers/
   */
  private _setTileUrls(
    mll: ILayerStackImage[],
    mllidx: number,
    someImage: IImage,
    baseLayerIndex: number
  ) {
    const mapentry = this.maps[mllidx];
    mll.forEach(
      (
        { layer, urls, fullUrls, hist, singleFrame, baseQuadOptions },
        layerIndex: number
      ) => {
        let fullLayer = mapentry.imageLayers[layerIndex * 2];
        let adjLayer = mapentry.imageLayers[layerIndex * 2 + 1];
        mapentry.lowestLayer = baseLayerIndex;
        layerIndex += baseLayerIndex;
        fullLayer.node().css("filter", `url(#recolor-${layerIndex})`);
        adjLayer.node().css("filter", "none");
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
  }

  @Watch("dataset")
  onDatasetChanged() {
    this.resetMapsOnDraw = true;
  }

  private draw(parentElement: HTMLElement) {
    if ((this.width == this.height && this.width == 1) || !this.dataset) {
      return;
    }
    if (!this.layerStackImages.length) {
      return;
    }
    const someImages = this.layerStackImages.find(lsi => lsi.images[0]);
    if (!someImages) {
      return;
    }
    let unrollCount = someImages.images.length;
    const someImage = someImages.images[0];
    this.unrollW = Math.min(
      unrollCount,
      Math.ceil(
        Math.sqrt(someImage.sizeX * someImage.sizeY * unrollCount) /
          someImage.sizeX
      )
    );
    this.unrollH = Math.ceil(unrollCount / this.unrollW);
    let tileWidth = someImage.tileWidth;
    let tileHeight = someImage.tileHeight;
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;

    const mapLayerList = this.mapLayerList;
    while (this.maps.length > mapLayerList.length) {
      const mapentry = this.maps.pop();
      if (mapentry) {
        mapentry.map.exit();
      }
    }
    let baseLayerIndex = 0;
    const currentResetMaps = this.resetMapsOnDraw;
    this.resetMapsOnDraw = false;
    mapLayerList.forEach((mll, mllidx) => {
      this._setupMap(mllidx, parentElement, someImage, currentResetMaps);
      const mapentry = this.maps[mllidx];
      if (!mapentry) {
        return;
      }
      const map = mapentry.map;
      const mapnode = map.node();
      const nodeWidth = mapnode.width();
      const nodeHeight = mapnode.height();
      if (
        nodeWidth &&
        nodeHeight &&
        (nodeWidth != map.size().width || nodeHeight != map.size().height)
      ) {
        map.size({ width: nodeWidth, height: nodeHeight });
      }
      this._setupTileLayers(mll, mllidx, someImage, baseLayerIndex);
      if (
        mapentry.workerPreviewLayer.zIndex() !== mll.length * 2 ||
        mapentry.annotationLayer.zIndex() !== mll.length * 2 + 1 ||
        mapentry.textLayer.zIndex() !== mll.length * 2 + 2 ||
        (mapentry.uiLayer && mapentry.uiLayer.zIndex() !== mll.length * 2 + 3)
      ) {
        mapentry.workerPreviewLayer.moveToTop();
        mapentry.annotationLayer.moveToTop();
        mapentry.textLayer.moveToTop();
        if (mapentry.uiLayer) {
          mapentry.uiLayer.moveToTop();
        }
      }
      this._setTileUrls(mll, mllidx, someImage, baseLayerIndex);
      baseLayerIndex += mll.length;
      map.draw();
    });
  }

  beforeDestroy() {
    if (this.maps) {
      this.maps.forEach(mapentry => mapentry.map.exit());
      this.maps = [];
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
.map-layout {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: black;
  line-height: 0;
}
.geojs-map {
  width: 100%;
  height: 100%;
}
.map-layout[map-count="2"] .geojs-map {
  width: 50%;
  height: 100%;
  display: inline-block;
}
.map-layout[map-count="3"] .geojs-map,
.map-layout[map-count="4"] .geojs-map {
  width: 50%;
  height: 50%;
  display: inline-block;
}
.map-layout[map-count="5"] .geojs-map,
.map-layout[map-count="6"] .geojs-map {
  width: 33%;
  height: 50%;
  display: inline-block;
}
.map-layout[map-count="7"] .geojs-map,
.map-layout[map-count="8"] .geojs-map,
.map-layout[map-count="9"] .geojs-map {
  width: 33%;
  height: 33%;
  display: inline-block;
}
.map-layout[map-count="10"] .geojs-map,
.map-layout[map-count="11"] .geojs-map,
.map-layout[map-count="12"] .geojs-map {
  width: 25%;
  height: 33%;
  display: inline-block;
}
.map-layout[map-count="13"] .geojs-map,
.map-layout[map-count="14"] .geojs-map,
.map-layout[map-count="15"] .geojs-map,
.map-layout[map-count="16"] .geojs-map {
  width: 25%;
  height: 25%;
  display: inline-block;
}
</style>
<style lang="scss">
.geojs-map .geojs-layer {
  mix-blend-mode: lighten;
}
</style>
