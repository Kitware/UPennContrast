<template>
  <div class="image" v-mousetrap="mousetrapAnnotations">
    <v-dialog v-model="scaleDialog">
      <v-card>
        <v-card-title> Scale settings </v-card-title>
        <v-card-text>
          <scale-settings />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn class="ma-2" @click="scaleDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <annotation-viewer
      v-for="(mapentry, index) in maps.filter(
        (mapentry) =>
          mapentry.annotationLayer &&
          mapentry.lowestLayer !== undefined &&
          mapentry.imageLayers &&
          mapentry.imageLayers.length,
      )"
      :map="mapentry.map"
      :selectionPath="mapentry.map === selectionMap ? selectionMousePath : []"
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
      ref="map-layout"
      v-description="{
        section: 'Objects',
        title: 'shift-click-drag',
        description: 'Lasso to select objects',
      }"
      :map-count="mapLayerList.length"
    >
      <div
        v-for="(_, index) in mapLayerList"
        :ref="`map-${index}`"
        :key="`geojsmap-${index}`"
        @mousedown.capture="mouseDown($event, index)"
        @mousemove.capture="mouseMove"
        @mouseup.capture="mouseUp"
      ></div>
    </div>
    <image-overview
      v-if="overview && !unrolling"
      :parentCameraInfo="cameraInfo"
      @centerChange="setCenter"
      @cornersChange="setCorners"
    />
    <div
      class="progress"
      v-for="(cacheObj, cacheIdx) in progresses"
      :key="'cache-' + cacheIdx"
    >
      <v-progress-linear
        :indeterminate="cacheObj.total === 0"
        :value="cacheObj.total ? (100 * cacheObj.progress) / cacheObj.total : 0"
        color="#CCC"
        background-color="blue-grey"
        style="height: 100%; z-index: inherit"
      >
        <strong class="text-center ma-1">
          {{ cacheObj.title }}
          <template v-if="cacheObj.total !== 0">
            {{ ((100 * cacheObj.progress) / cacheObj.total).toFixed(1) }}% ({{
              cacheObj.progress
            }}&nbsp;/&nbsp;{{ cacheObj.total }})
          </template>
        </strong>
      </v-progress-linear>
    </div>
    <v-alert
      class="progress-done"
      :value="loadedAndOptimized"
      type="success"
      dense
      dismissible
      transition="slide-x-transition"
    >
      Dataset fully loaded and optimized
    </v-alert>
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
import girderResources from "@/store/girderResources";
import geojs from "geojs";
import { markRaw } from "vue";

import {
  IGeoJSMap,
  IGeoJSPoint,
  IGeoJSTile,
  IImage,
  ILayerStackImage,
  IMapEntry,
  ICameraInfo,
  IXYPoint,
} from "../store/model";
import setFrameQuad, { ISetQuadStatus } from "@/utils/setFrameQuad";

import AnnotationViewer from "@/components/AnnotationViewer.vue";
import ImageOverview from "@/components/ImageOverview.vue";
import ScaleSettings from "@/components/ScaleSettings.vue";
import { ITileHistogram } from "@/store/images";
import { convertLength } from "@/utils/conversion";
import jobs, { jobStates } from "@/store/jobs";
import { IHotkey } from "@/utils/v-mousetrap";

function generateFilterURL(
  index: number,
  contrast: { whitePoint: number; blackPoint: number; mode: string },
  color: string,
  hist: ITileHistogram | null,
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
    level: number,
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

@Component({ components: { AnnotationViewer, ImageOverview, ScaleSettings } })
export default class ImageViewer extends Vue {
  readonly store = store;
  readonly annotationStore = annotationStore;
  readonly girderResources = girderResources;

  $refs!: {
    "map-layout": HTMLElement;
    [mapRef: string]: HTMLElement | HTMLElement[]; // map-${idx}
  };

  // Mousetrap bindings
  readonly mousetrapAnnotations: IHotkey[] = [
    {
      bind: "a",
      handler: () => {
        this.store.setDrawAnnotations(!this.store.drawAnnotations);
      },
      data: {
        section: "Objects",
        description: "Show/hide objects",
      },
    },
    {
      bind: "t",
      handler: () => {
        this.store.setShowTooltips(!this.store.showTooltips);
      },
      data: {
        section: "Objects",
        description: "Show/hide object tooltips",
      },
    },
    {
      bind: "mod+backspace",
      handler: () => {
        annotationStore.deleteSelectedAnnotations();
      },
      data: {
        section: "Objects",
        description: "Delete selected objects",
      },
    },
    {
      bind: "mod+z",
      handler: () => {
        this.store.do(true);
      },
      data: {
        section: "Objects",
        description: "Undo last action",
      },
    },
    {
      bind: "mod+shift+z",
      handler: () => {
        this.store.do(false);
      },
      data: {
        section: "Objects",
        description: "Redo last action",
      },
    },
  ];

  private refsMounted = false;

  private readyLayers: boolean[] = [];

  private resetMapsOnDraw = false;

  scaleDialog = false;

  get maps() {
    return this.store.maps;
  }

  set maps(value: IMapEntry[]) {
    this.store.setMaps(value);
  }

  get overview() {
    return this.store.overview;
  }

  tileWidth: number = 0;
  tileHeight: number = 0;

  unrollW: number = 1;
  unrollH: number = 1;

  private _inPan: boolean = false;
  cameraInfo: ICameraInfo = {
    center: { x: 0, y: 0 },
    zoom: 1,
    rotate: 0,
    gcsBounds: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
  };

  histogramCaches: number = 0;
  cacheProgresses: { progress: number; total: number }[] = [];

  get loadedAndOptimized() {
    return (
      this.cacheProgresses.length === 0 &&
      this.annotationStore.progresses.length === 0 &&
      this.histogramCaches <= 0
    );
  }

  get progresses() {
    // Merge caching and downloading of annotations and connections
    const progresses: {
      progress: number;
      total: number;
      title: string;
    }[] = [];
    if (this.readyLayersCount < this.readyLayersTotal) {
      progresses.push({
        progress: this.readyLayersCount,
        total: this.readyLayersTotal,
        title: "Preparing layers",
      });
    }
    if (this.histogramCaches > 0) {
      progresses.push({
        progress: 0,
        total: 0,
        title: "Computing histograms",
      });
    }
    for (const progress of this.cacheProgresses) {
      progresses.push({ ...progress, title: "Optimizing performance" });
    }
    for (const progress of this.annotationStore.progresses) {
      if (!progress.annotationDone) {
        progresses.push({
          progress: progress.annotationProgress,
          total: progress.annotationTotal,
          title: "Downloading annotations",
        });
      }
      if (!progress.connectionDone) {
        progresses.push({
          progress: progress.connectionProgress,
          total: progress.connectionTotal,
          title: "Downloading connections",
        });
      }
    }
    return progresses;
  }

  get readyLayersCount() {
    return this.readyLayers.reduce(
      (count, ready) => (ready ? count + 1 : count),
      0,
    );
  }

  get readyLayersTotal() {
    return this.readyLayers.length;
  }

  get dataset() {
    return this.store.dataset;
  }

  get unrolling() {
    return this.store.unroll;
  }

  get width() {
    return this.store.dataset ? this.store.dataset.width : 1;
  }

  get height() {
    return this.store.dataset ? this.store.dataset.height : 1;
  }

  get compositionMode() {
    return this.store.compositionMode;
  }

  get backgroundColor() {
    return this.store.backgroundColor;
  }

  mounted() {
    this.refsMounted = true;
    this.datasetReset();
    this.updateBackgroundColor();
    this.draw();
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
      this.layerStackImages.forEach((lsi) => {
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

  async datasetReset() {
    // Get histogram progresses
    this.histogramCaches = 0;
    const datasetId = this.dataset?.id;
    if (!datasetId) {
      return;
    }
    const girderJobs = await this.store.api.findJobs(
      "large_image_cache_histograms",
      [jobStates.inactive, jobStates.queued, jobStates.running],
    );
    const validityPromises = girderJobs.map(async (girderJob: any) => {
      const largeImageId = girderJob?.kwargs?.itemId || null;
      const largeImageItem = await this.girderResources.getItem(largeImageId);
      return !!largeImageItem && datasetId === largeImageItem.folderId;
    });
    const validityArray = await Promise.all(validityPromises);
    const filteredJobs = girderJobs.filter((_, i) => validityArray[i]);
    filteredJobs.forEach((girderJob: any) => {
      const jobId = girderJob._id;
      let cacheIncreased = false;
      // Increase number of caching histograms when running
      const eventCallback = (jobInfo: any) => {
        const newStatus = jobInfo.status;
        if (
          !cacheIncreased &&
          typeof newStatus === "number" &&
          newStatus === jobStates.running
        ) {
          ++this.histogramCaches;
          cacheIncreased = true;
        }
      };
      eventCallback(girderJob);
      // Decrease number of caching histograms if it has been increased
      const callback = () => {
        if (cacheIncreased) {
          --this.histogramCaches;
        }
      };
      jobs.addJob({ jobId, datasetId, callback, eventCallback });
    });
  }

  selectionMap: IGeoJSMap | null = null;
  selectionTarget: HTMLElement | null = null;
  selectionMousePath: IGeoJSPoint[] = [];

  mouseDown(evt: any, mapIdx: number) {
    if (evt.shiftKey) {
      const mapEntry = this.maps?.[mapIdx];
      if (!mapEntry) {
        return;
      }

      // Setup selection variables
      this.selectionMap = mapEntry.map;
      this.selectionTarget = evt.target;
      this.selectionMousePath = [];

      // Will add the current point and stop propagation
      this.mouseMove(evt);
    }
  }

  mouseMove(evt: any) {
    if (this.selectionMap) {
      evt.stopPropagation();
      const rect = this.selectionTarget!.getBoundingClientRect();
      const displayPoint = { x: evt.x - rect.x, y: evt.y - rect.y };
      const gcsPoint = this.selectionMap.displayToGcs(displayPoint);
      this.selectionMousePath.push(gcsPoint);
    }
  }

  mouseUp(evt: any) {
    if (this.selectionMap) {
      evt.stopPropagation();
      this.selectionMap = null;
      this.selectionTarget = null;
      this.selectionMousePath = [];
    }
  }

  setCenter(center: IGeoJSPoint) {
    this.cameraInfo.center = center;
    this.applyCameraInfo();
  }

  setCorners(evt: any) {
    const map = this.maps[0]?.map;
    if (!map) {
      return;
    }
    const mapsize = map.size();
    const lowerLeft = map.gcsToDisplay(evt.lowerLeftGcs);
    const upperRight = map.gcsToDisplay(evt.upperRightGcs);
    const scaling = {
      x: Math.abs((upperRight.x - lowerLeft.x) / mapsize.width),
      y: Math.abs((upperRight.y - lowerLeft.y) / mapsize.height),
    };
    const center = map.displayToGcs(
      {
        x: (lowerLeft.x + upperRight.x) / 2,
        y: (lowerLeft.y + upperRight.y) / 2,
      },
      null,
    );
    const zoom = map.zoom() - Math.log2(Math.max(scaling.x, scaling.y));
    map.zoom(zoom);
    map.center(center, null);
  }

  /**
   * Synchronize all maps on any pan event.
   */
  private _handlePan(mapidx: number) {
    if (!this.maps) {
      return;
    }
    if (this._inPan) {
      return;
    }
    this._inPan = true;
    const map = this.maps[mapidx].map;
    const size = map.size();
    this.cameraInfo = {
      zoom: map.zoom(),
      rotate: map.rotation(),
      center: map.center(),
      gcsBounds: [
        map.displayToGcs({ x: 0, y: 0 }),
        map.displayToGcs({ x: size.width, y: 0 }),
        map.displayToGcs({ x: size.width, y: size.height }),
        map.displayToGcs({ x: 0, y: size.height }),
      ],
    };
    if (this.maps.length >= 2) {
      this.applyCameraInfo(mapidx);
    }
    this._inPan = false;
  }

  applyCameraInfo(excludeMapIdx?: number) {
    try {
      this.maps.forEach((mapentry, idx) => {
        if (idx === excludeMapIdx) {
          return;
        }
        mapentry.map.zoom(this.cameraInfo.zoom, undefined, true, true);
        mapentry.map.rotation(this.cameraInfo.rotate, undefined, true);
        mapentry.map.center(this.cameraInfo.center, undefined, true, true);
      });
    } catch (err) {}
  }

  @Watch("compositionMode")
  updateCompositionMode() {
    for (const mapentry of this.maps) {
      for (const imageLayer of mapentry.imageLayers) {
        imageLayer.node().css({ "mix-blend-mode": this.compositionMode });
      }
    }
  }

  @Watch("backgroundColor")
  updateBackgroundColor() {
    this.$refs["map-layout"].style.background = this.backgroundColor;
  }

  @Watch("mapLayerList")
  updateMapLayerList() {
    Vue.nextTick(() => {
      if (!this.refsMounted) {
        return;
      }
      this.draw();
    });
  }

  private blankUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQIHWNgYAAAAAMAAU9ICq8AAAAASUVORK5CYII=";

  private _setupMap(
    mllidx: number,
    someImage: IImage,
    forceReset: boolean = false,
  ) {
    const mapRefs = this.$refs[`map-${mllidx}`] as HTMLElement[] | undefined;
    const mapElement = mapRefs?.[0];
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
      this.tileHeight,
    );
    params.map.maxBounds.right = mapWidth;
    params.map.maxBounds.bottom = mapHeight;
    params.map.min -= Math.ceil(
      Math.log(Math.max(this.unrollW, this.unrollH)) / Math.log(2),
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

    if (this.maps.length <= mllidx || needReset) {
      const map: IGeoJSMap = geojs.map(params.map);
      map.geoOn(geojs.event.pan, () => this._handlePan(mllidx));

      const interactorOpts = map.interactor().options();
      const keyboardOpts = interactorOpts.keyboard;
      if (keyboardOpts?.actions) {
        /* remove default key bindings */
        const oldActions = keyboardOpts.actions;
        const newActions: typeof oldActions = {};
        /* We can keep some actions, if wanted */
        if ("rotate.0" in oldActions) {
          newActions["rotate.0"] = oldActions["rotate.0"];
        }
        keyboardOpts.actions = newActions;
      }
      map.interactor().options(interactorOpts);
      const annotationLayer = map.createLayer("annotation", {
        annotations: geojs.listAnnotations(),
        autoshareRenderer: false,
        continuousCloseProximity: true,
        showLabels: false,
      });
      const workerPreviewLayer = map.createLayer("feature", {
        renderer: mllidx ? "canvas" : undefined,
        features: ["quad", "quad.image"],
      });
      const workerPreviewFeature = workerPreviewLayer.createFeature("quad");
      const textLayer = map.createLayer("feature", { features: ["text"] });

      annotationLayer.node().css({ "mix-blend-mode": "unset" });
      workerPreviewLayer.node().css({ "mix-blend-mode": "unset" });
      textLayer.node().css({ "mix-blend-mode": "unset" });

      const mapentry: IMapEntry = {
        map,
        imageLayers: markRaw([]),
        params: markRaw(params),
        baseLayerIndex: mllidx ? undefined : 0,
        annotationLayer,
        workerPreviewLayer,
        textLayer,
        workerPreviewFeature,
      };
      Vue.set(this.maps, mllidx, mapentry);
    } else {
      const mapentry = this.maps[mllidx];
      mapentry.params = markRaw(params);
      const map = mapentry.map;
      const adjustLayers =
        Math.abs(map.maxBounds(undefined, null).right - mapWidth) >= 0.5 ||
        Math.abs(map.maxBounds(undefined, null).bottom - mapHeight) >= 0.5;
      if (adjustLayers) {
        map.maxBounds({
          left: 0,
          top: 0,
          right: params.map.maxBounds.right,
          bottom: params.map.maxBounds.bottom,
        });
        map.zoomRange(params.map);
      }
    }

    // only have a scale widget on the first map
    if (!mllidx) {
      const mapentry = this.maps[mllidx];
      if (!mapentry.uiLayer) {
        mapentry.uiLayer = mapentry.map.createLayer("ui");
        mapentry.uiLayer.node().css({ "mix-blend-mode": "unset" });
      }
      const pixelSizeScale = this.store.scales.pixelSize;
      const pixelSizeM = convertLength(
        pixelSizeScale.value,
        pixelSizeScale.unit,
        "m",
      );
      if (
        mapentry.scaleWidget &&
        (mapentry.scaleWidget.options("scale") !== pixelSizeM ||
          !this.store.showScalebar)
      ) {
        mapentry.uiLayer.deleteWidget(mapentry.scaleWidget);
        mapentry.scaleWidget = null;
      }
      if (!mapentry.scaleWidget && this.store.showScalebar) {
        mapentry.scaleWidget = mapentry.uiLayer.createWidget("scale", {
          scale: pixelSizeM,
          strokeWidth: 5,
          tickLength: 0,
          position: { bottom: 20, right: 10 },
        });
        const svgElement = mapentry.scaleWidget.parentCanvas()
          .firstChild as SVGElement;
        svgElement.classList.add("scale-widget");
        svgElement.onclick = (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          this.scaleDialog = true;
        };
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
    baseLayerIndex: number,
  ) {
    const mapentry = this.maps[mllidx];
    const map = mapentry.map;
    // adjust number of tile layers
    while (
      mapentry.imageLayers.length > mll.length * 2 ||
      (mapentry.baseLayerIndex !== baseLayerIndex &&
        mapentry.imageLayers.length)
    ) {
      map.deleteLayer(mapentry.imageLayers.pop()!);
    }
    mapentry.baseLayerIndex = baseLayerIndex;
    while (mapentry.imageLayers.length < mll.length * 2) {
      mapentry.params.layer.tilesAtZoom = (level: number) => {
        const s = Math.pow(2, someImage.levels - 1 - level);
        const result = {
          x:
            Math.ceil(someImage.sizeX / s / someImage.tileWidth) * this.unrollW,
          y:
            Math.ceil(someImage.sizeY / s / someImage.tileHeight) *
            this.unrollH,
        };
        return result;
      };
      const currentImageLayers = this.maps.reduce(
        (acc, entry) => acc + (entry.imageLayers || []).length,
        0,
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
      const newMap = map.createLayer("osm", mapentry.params.layer);
      newMap.node().css({ "mix-blend-mode": this.compositionMode });
      mapentry.imageLayers.push(newMap);
      let layer = mapentry.imageLayers[mapentry.imageLayers.length - 1];
      if (mapentry.imageLayers.length & 1) {
        const index = (mapentry.imageLayers.length - 1) / 2;
        layer.node().css("filter", `url(#recolor-${index + baseLayerIndex})`);
      }
      layer.url((x: number, y: number, level: number) => {
        const s = Math.pow(2, someImage.levels - 1 - level);
        const txy = {
          x: Math.ceil(someImage.sizeX / s / someImage.tileWidth),
          y: Math.ceil(someImage.sizeY / s / someImage.tileHeight),
        };
        const imageNum =
          Math.floor(x / txy.x) + Math.floor(y / txy.y) * this.unrollW;
        const url = layer._imageUrls?.[imageNum];
        if (!url) {
          return this.blankUrl;
        }
        const tx = x % txy.x;
        const ty = y % txy.y;
        const result = url
          .replace("{z}", level.toString())
          .replace("{x}", tx.toString())
          .replace("{y}", ty.toString());
        return result;
      });
      layer._tileBounds = (tile: IGeoJSTile) => {
        const s = Math.pow(2, someImage.levels - 1 - (tile.index.level || 0));
        const w = Math.ceil(someImage.sizeX / s),
          h = Math.ceil(someImage.sizeY / s);
        const txy = {
          x: Math.ceil(someImage.sizeX / s / someImage.tileWidth),
          y: Math.ceil(someImage.sizeY / s / someImage.tileHeight),
        };
        const imagexy = {
          x: Math.floor(tile.index.x / txy.x),
          y: Math.floor(tile.index.y / txy.y),
        };
        const tilexy = {
          x: tile.index.x % txy.x,
          y: tile.index.y % txy.y,
        };
        const result = {
          left: tilexy.x * tile.size.x + w * imagexy.x,
          top: tilexy.y * tile.size.y + h * imagexy.y,
          right: Math.min((tilexy.x + 1) * tile.size.x, w) + w * imagexy.x,
          bottom: Math.min((tilexy.y + 1) * tile.size.y, h) + h * imagexy.y,
        };
        return result;
      };
      layer.tileAtPoint = (point: IXYPoint, level: number) => {
        point = layer.displayToLevel(
          layer.map().gcsToDisplay(point, null),
          someImage.levels - 1,
        );
        const s = Math.pow(2, someImage.levels - 1 - level);
        const x = point.x,
          y = point.y;
        const txy = {
          x: Math.ceil(someImage.sizeX / s / someImage.tileWidth),
          y: Math.ceil(someImage.sizeY / s / someImage.tileHeight),
        };
        const result = {
          x:
            Math.floor(x / someImage.sizeX) * txy.x +
            Math.floor(
              (x - Math.floor(x / someImage.sizeX) * someImage.sizeX) /
                someImage.tileWidth /
                s,
            ),
          y:
            Math.floor(y / someImage.sizeY) * txy.y +
            Math.floor(
              (y - Math.floor(y / someImage.sizeY) * someImage.sizeY) /
                someImage.tileHeight /
                s,
            ),
        };
        return result;
      };
    }
  }

  /**
   * Set tile urls for all tile layers/
   */
  private _setTileUrls(
    mll: ILayerStackImage[],
    mllidx: number,
    someImage: IImage,
    baseLayerIndex: number,
  ) {
    const mapentry = this.maps[mllidx];
    mll.forEach(
      (
        { layer, urls, fullUrls, hist, singleFrame, baseQuadOptions },
        layerIndex: number,
      ) => {
        const fullLayer = mapentry.imageLayers[layerIndex * 2];
        const adjLayer = mapentry.imageLayers[layerIndex * 2 + 1];
        mapentry.lowestLayer = baseLayerIndex;
        layerIndex += baseLayerIndex;
        fullLayer.node().css("filter", `url(#recolor-${layerIndex})`);
        adjLayer.node().css("filter", "none");
        if (!fullUrls[0] || !urls[0] || !baseQuadOptions) {
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
          return;
        }
        generateFilterURL(layerIndex, layer.contrast, layer.color, hist);
        fullLayer.visible(true);
        adjLayer.visible(true);
        // use css visibility so that geojs will still load tiles when not
        // visible.
        const layerImageUrls = fullLayer._imageUrls;
        if (
          !layerImageUrls ||
          fullUrls.length !== layerImageUrls.length ||
          fullUrls.some((url, idx) => url !== layerImageUrls[idx])
        ) {
          fullLayer._imageUrls = fullUrls;
          fullLayer.reset();
          // or max-merge
          if (fullUrls.length !== 1 || singleFrame === null) {
            fullLayer.baseQuad = null;
          } else {
            if (!fullLayer.setFrameQuad) {
              const progessObject = { progress: 0, total: 0 };
              this.cacheProgresses.push(progessObject);
              setFrameQuad(someImage.tileinfo, fullLayer, baseQuadOptions, {
                progress: (status: ISetQuadStatus) => {
                  progessObject.progress = status.loadedCount;
                  progessObject.total = status.totalToLoad;
                  if (progessObject.progress >= progessObject.total) {
                    this.cacheProgresses = this.cacheProgresses.filter(
                      (obj) => obj !== progessObject,
                    );
                  }
                },
              });
            }
            fullLayer.setFrameQuad!(singleFrame);
          }
        }
        const adjImageUrls = adjLayer._imageUrls;
        if (
          !adjImageUrls ||
          urls.length !== adjImageUrls.length ||
          urls.some((url, idx) => url !== adjImageUrls[idx])
        ) {
          adjLayer._imageUrls = urls;
          adjLayer.reset();
          adjLayer.map().draw();
          adjLayer.onIdle(() => {
            if (
              fullUrls.every(
                (url, idx) => url === fullLayer._imageUrls?.[idx],
              ) &&
              urls.every((url, idx) => url === adjLayer._imageUrls?.[idx])
            ) {
              fullLayer.node().css("visibility", "hidden");
              adjLayer
                .node()
                .css("visibility", layer.visible ? "visible" : "hidden");
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
      },
    );
  }

  @Watch("dataset")
  onDatasetChanged() {
    this.resetMapsOnDraw = true;
    this.datasetReset();
  }

  private draw() {
    if ((this.width == this.height && this.width == 1) || !this.dataset) {
      return;
    }
    if (!this.layerStackImages.length) {
      return;
    }
    const someImages = this.layerStackImages.find((lsi) => lsi.images[0]);
    if (!someImages) {
      return;
    }
    let unrollCount = someImages.images.length;
    const someImage = someImages.images[0];
    this.unrollW = Math.min(
      unrollCount,
      Math.ceil(
        Math.sqrt(someImage.sizeX * someImage.sizeY * unrollCount) /
          someImage.sizeX,
      ),
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
      this._setupMap(mllidx, someImage, currentResetMaps);
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

    // Track progress of layers
    const readyLayers: boolean[] = [];
    let readyLayersIdx = 0;
    for (let mllidx = 0; mllidx < mapLayerList.length; ++mllidx) {
      const mapentry = this.maps[mllidx];
      if (!mapentry) {
        continue;
      }
      for (
        let layerIdx = 0;
        layerIdx < mapLayerList[mllidx].length;
        ++layerIdx
      ) {
        // Fresh binding of readyLayersIdx to use it in the arrow function
        const capturedIdx = readyLayersIdx++;

        const fullLayer = mapentry.imageLayers[2 * layerIdx];
        const adjLayer = mapentry.imageLayers[2 * layerIdx + 1];
        Vue.set(readyLayers, capturedIdx, false);
        const setReady = () => {
          if (fullLayer.idle && adjLayer.idle) {
            Vue.set(readyLayers, capturedIdx, true);
          }
        };
        fullLayer.onIdle(setReady);
        adjLayer.onIdle(setReady);
      }
    }
    this.readyLayers = readyLayers;
  }

  beforeDestroy() {
    if (this.maps) {
      this.maps.forEach((mapentry) => mapentry.map.exit());
      this.maps = [];
    }
  }
}
</script>

<style lang="scss">
.progress .v-progress-linear__content {
  position: relative;
}

.geojs-scale-widget-bar {
  stroke: white;
}

.geojs-scale-widget-text {
  fill: white;
}

.scale-widget {
  overflow: visible;
}

.scale-widget:hover {
  cursor: pointer;
}
</style>

<style lang="scss" scoped>
.image {
  position: relative;
  overflow: hidden;
}
.progress {
  color: white;
  font-size: 12px;
  margin-bottom: 2px;
  width: 200px;
  z-index: 200;
}
.progress-done {
  width: fit-content;
  z-index: 200;
  margin: 4px;
}
.map-layout {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
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
