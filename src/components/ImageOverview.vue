<template>
  <div class="wrapper" ref="overview-wrapper">
    <div class="header" @mousedown="headerMouseDown">
      <v-icon
        v-for="(item, idx) in cornerItems"
        :key="`overview-header-icon-${idx}`"
        class="header-icon"
        @click="moveOverviewToCorner(item)"
      >
        {{ cornerToIcon(item) }}
      </v-icon>
    </div>
    <div class="map" ref="overview-map"></div>
  </div>
</template>

<script lang="ts">
import geojs from "geojs";

import store from "@/store";
import {
  IGeoJSFeature,
  IGeoJSFeatureLayer,
  IGeoJSMap,
  IGeoJSOsmLayer,
  ICameraInfo,
  IDownloadParameters,
} from "@/store/model";
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import {
  getBaseURLFromDownloadParameters,
  getLayersDownloadUrls,
} from "@/utils/screenshot";

interface ICorner {
  top: boolean;
  left: boolean;
}

@Component({ components: {} })
export default class ImageViewer extends Vue {
  readonly store = store;

  @Prop()
  parentCameraInfo!: ICameraInfo;

  $refs!: {
    "overview-map": HTMLElement;
    "overview-wrapper": HTMLElement;
  };

  map: IGeoJSMap | null = null;
  observer: ResizeObserver | null = null;
  osmLayer: IGeoJSOsmLayer | null = null;
  featureLayer: IGeoJSFeatureLayer | null = null;
  outlineFeature: IGeoJSFeature | null = null;

  downState:
    | (ICameraInfo & {
        state: any; // geo.actionState
        mouse: any; // geo.mouseState
        distanceToOutline: number;
      })
    | null = null;

  // Each possible corner: top-left, bottom-left, top-right, bottom-right
  // Used to display arrows in the header of the overview
  readonly cornerItems: ICorner[] = [
    { top: true, left: true },
    { top: false, left: true },
    { top: true, left: false },
    { top: false, left: false },
  ];

  cornerToIcon({ top, left }: ICorner) {
    return `mdi-arrow-${top ? "top" : "bottom"}-${left ? "left" : "right"}`;
  }

  moveOverviewToCorner({ top, left }: ICorner) {
    const elem = this.$refs["overview-wrapper"];
    if (!elem) {
      return;
    }
    elem.style.top = top ? "0" : "auto";
    elem.style.bottom = top ? "auto" : "0";
    elem.style.left = left ? "0" : "auto";
    elem.style.right = left ? "auto" : "0";
    return { top, left };
  }

  headerMouseDown(evt: MouseEvent) {
    const elem = this.$refs["overview-wrapper"];
    if (!elem) {
      return;
    }
    const baseX = elem.offsetLeft - evt.clientX;
    const baseY = elem.offsetTop - evt.clientY;

    const mouseMove = (evt: MouseEvent) => {
      evt.preventDefault();
      evt.stopPropagation();

      let top = baseY + evt.clientY;
      let left = baseX + evt.clientX;

      top = Math.max(0, top);
      left = Math.max(0, left);

      const parent = elem.offsetParent;
      if (parent) {
        const parentBottom = parent.clientTop + parent.clientHeight;
        const parentRight = parent.clientLeft + parent.clientWidth;
        const elemBottom = top + elem.clientHeight;
        const elemRight = left + elem.clientWidth;
        top -= Math.max(0, elemBottom - parentBottom);
        left -= Math.max(0, elemRight - parentRight);
      }

      elem.style.top = `${top}px`;
      elem.style.left = `${left}px`;
      elem.style.bottom = "auto";
      elem.style.right = "auto";
    };

    const mouseUp = () => {
      document.removeEventListener("mousemove", mouseMove);
      document.removeEventListener("mouseup", mouseUp);
    };

    document.addEventListener("mousemove", mouseMove);
    document.addEventListener("mouseup", mouseUp);
  }

  get dataset() {
    return this.store.dataset;
  }

  get urlPromise() {
    if (!this.dataset || !this.map) {
      return;
    }

    const anyImage = this.dataset.anyImage();
    if (!anyImage) {
      return;
    }

    // Always use level 0
    const unitsPerPixel = this.map.unitsPerPixel(0);
    const params: IDownloadParameters = {
      encoding: "JPEG",
      contentDisposition: "inline",
      contentDispositionFilename: "overview.jpeg",
      width: Math.round(anyImage.sizeX / unitsPerPixel),
      height: Math.round(anyImage.sizeY / unitsPerPixel),
    };
    const itemId = anyImage.item._id;
    const apiRoot = this.store.api.client.apiRoot;
    const baseUrl = getBaseURLFromDownloadParameters(params, itemId, apiRoot);

    const layers = this.store.layers;
    return getLayersDownloadUrls(
      baseUrl,
      "composite",
      layers,
      this.dataset,
      this.store.currentLocation,
    ).then((urls) => urls[0].url);
  }

  mounted() {
    this.create();
  }

  @Watch("dataset")
  create() {
    const elem = this.$refs["overview-map"];
    const someImage = this.dataset?.anyImage();
    if (!someImage || !elem) {
      return;
    }

    const params = geojs.util.pixelCoordinateParams(
      elem,
      someImage.sizeX,
      someImage.sizeY,
      someImage.tileWidth,
      someImage.tileHeight,
    );
    params.layer.crossDomain = "use-credentials";
    params.layer.url = "";
    params.layer.renderer = "canvas";
    /* We want the actions to trigger on the overview, but affect the main
     * image, so we have to rerig all of the actions */
    params.map.interactor = geojs.mapInteractor({
      actions: [
        {
          action: "overview_pan",
          input: "left",
          modifiers: { shift: false, ctrl: false },
          owner: "nimbusimage.overview",
          name: "button pan",
        },
        {
          action: "overview_zoomselect",
          input: "left",
          modifiers: { shift: true, ctrl: false },
          selectionRectangle: geojs.event.zoomselect,
          owner: "nimbusimage.overview",
          name: "drag zoom",
        },
      ],
      keyboard: {
        actions: {},
      },
    });
    this.map = geojs.map(params.map);

    if (window.ResizeObserver) {
      this.observer = new window.ResizeObserver(() => {
        if (!this.map) {
          return;
        }
        const node = this.map.node();
        const width = node.width();
        const height = node.height();
        if (width && height) {
          this.map.size({ width, height });
        }
      });
      this.observer.observe(this.map.node()[0]);
    }

    params.layer.autoshareRenderer = false;
    // Always use level 0
    params.layer.tileRounding = () => 0;
    this.osmLayer = this.map.createLayer("osm", params.layer);
    this.featureLayer = this.map.createLayer("feature", {
      features: ["polygon"],
    });
    this.outlineFeature = this.featureLayer.createFeature("polygon", {
      style: {
        stroke: true,
        strokeColor: "cyan",
        strokeWidth: 2,
        fill: false,
      },
    });
    /* Clicking in the overview recenters to that spot */
    this.featureLayer.geoOn(geojs.event.mouseclick, (evt: any) => {
      this.$emit("centerChange", evt.geo);
    });
    this.featureLayer.geoOn(geojs.event.actiondown, (evt: any) => {
      if (!this.map || !this.outlineFeature) {
        return;
      }
      this.downState = {
        ...this.parentCameraInfo,
        state: evt.state,
        mouse: evt.mouse,
        distanceToOutline:
          geojs.util.distanceToPolygon2d(
            evt.mouse.geo,
            this.outlineFeature.data()[0],
          ) / this.map.unitsPerPixel(this.map.zoom()),
      };
    });
    const panOutlineDistance = 5;
    this.featureLayer.geoOn(geojs.event.actionmove, (evt: any) => {
      if (
        evt.state.action === "overview_pan" &&
        this.downState &&
        this.downState.distanceToOutline >= -panOutlineDistance
      ) {
        const delta = {
          x: evt.mouse.geo.x - this.downState.mouse.geo.x,
          y: evt.mouse.geo.y - this.downState.mouse.geo.y,
        };
        const center = this.parentCameraInfo.center;
        delta.x -= center.x - this.downState.center.x;
        delta.y -= center.y - this.downState.center.y;
        if (delta.x || delta.y) {
          this.$emit("centerChange", {
            x: center.x + delta.x,
            y: center.y + delta.y,
          });
        }
      }
    });
    this.featureLayer.geoOn(geojs.event.actionselection, (evt: any) => {
      if (
        evt.lowerLeft.x === evt.upperRight.x ||
        evt.lowerLeft.y === evt.upperRight.y ||
        !this.map
      ) {
        return;
      }
      const lowerLeftGcs = this.map.displayToGcs(evt.lowerLeft);
      const upperRightGcs = this.map.displayToGcs(evt.upperRight);
      this.$emit("cornersChange", { lowerLeftGcs, upperRightGcs });
    });
    this.map.draw();
  }

  @Watch("parentCameraInfo")
  onParentPan() {
    if (this.map && this.parentCameraInfo.rotate !== this.map.rotation()) {
      this.map.rotation(this.parentCameraInfo.rotate);
      // Always use the smallest zoom possible
      // It will be clamped automatically
      this.map.zoom(-Infinity);
    }
    this.outlineFeature?.data([this.parentCameraInfo.gcsBounds]).draw();
  }

  @Watch("urlPromise")
  @Watch("osmLayer")
  async onUrlChanged() {
    if (!this.osmLayer) {
      return;
    }
    if (this.urlPromise) {
      const url = await this.urlPromise;
      this.osmLayer.url(url.toString());
    } else {
      this.osmLayer.url("");
    }
  }
}
</script>

<style scoped lang="scss">
.wrapper {
  position: absolute;
  background: black;
  border: 1px solid white;
  z-index: 100;
}
.map {
  width: 150px;
  height: 150px;
}
.header {
  display: flex;
  justify-content: center;
  width: 100%;
  height: 16px;
  background: rgb(2, 119, 189);
  font-size: 16px;
  line-height: 0;
}
.header-icon {
  font-size: 16px;
  margin: 0 4px;
}
</style>
