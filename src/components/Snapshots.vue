<template>
  <div class="snapshots">
    <v-dialog v-model="dialog" width="500" v-if="store.configuration">
      <template v-slot:activator="{ on: { click }, attrs }">
        <v-btn v-bind="attrs" v-on:click="showDialog(true)">
          Snapshot
        </v-btn>
      </template>

      <v-card>
        <v-card-title class="headline">
          Download
        </v-card-title>
        <v-card-text class="pb-0">
          <div class="group-label" :totalarea="totalArea">
            Resolution and Area:
          </div>
          <v-radio-group v-model="area" row>
            <v-radio
              label="Screen"
              value="screen"
              title="The exact pixels on the screen"
            ></v-radio>
            <v-radio
              label="Viewport"
              value="view"
              v-if="!isRotated() && !isUnrolled"
              title="The visible area of the screen, but rendered from the source image.  This can be higher resolution than the screen."
            ></v-radio>
            <v-radio
              label="Bounding box"
              value="bbox"
              v-if="!isRotated() && !isUnrolled"
              title="A selected bounding box"
            ></v-radio>
            <v-radio
              label="Full"
              value="full"
              v-if="!isUnrolled"
              title="The entire image"
            ></v-radio>
          </v-radio-group>
          <v-row>
            <v-col class="pa-2">
              <v-text-field
                label="Left"
                :disabled="area !== 'bbox'"
                v-model="bboxLeft"
                type="number"
                :max="store.dataset.width"
                dense
              ></v-text-field>
            </v-col>
            <v-col class="pa-2">
              <v-text-field
                label="Top"
                :disabled="area !== 'bbox'"
                v-model="bboxTop"
                type="number"
                :max="store.dataset.height"
                dense
              ></v-text-field>
            </v-col>
            <v-col class="pa-2">
              <v-text-field
                label="Right"
                :disabled="area !== 'bbox'"
                v-model="bboxRight"
                type="number"
                :max="store.dataset.width"
                dense
              ></v-text-field>
            </v-col>
            <v-col class="pa-2">
              <v-text-field
                label="Bottom"
                :disabled="area !== 'bbox'"
                v-model="bboxBottom"
                type="number"
                :max="store.dataset.height"
                dense
              ></v-text-field>
            </v-col>
            <v-col class="pa-2">
              <v-btn color="primary" text @click="drawBoundingBox()">
                Draw
              </v-btn>
            </v-col>
          </v-row>
          <v-row>
            <v-col class="pa-2">
              <v-text-field
                label="Maximum resolution"
                :disabled="area == 'screen'"
                v-model="maxResolution"
                type="number"
                :max="
                  Math.min(
                    format === 'tiff' ? 1e8 : 10000,
                    Math.max(store.dataset.width, store.dataset.height)
                  )
                "
                dense
              ></v-text-field>
            </v-col>
            <v-col class="pa-2">
              <v-select
                v-model="exportLayer"
                :items="layerList"
                label="Layer"
                item-text="name"
                item-value="key"
                dense
              ></v-select>
            </v-col>
            <v-col class="pa-2">
              <v-select
                v-model="format"
                :items="formatList"
                label="Format"
                item-text="name"
                item-value="key"
                dense
              ></v-select>
            </v-col>
          </v-row>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="primary"
            text
            @click="
              showDialog(false);
              getDownload();
            "
          >
            Download
          </v-btn>
          <v-btn color="primary" text @click="showDialog(false)">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import store from "@/store";
import geojs from "geojs";

@Component
export default class Snapshots extends Vue {
  readonly store = store;

  dialog = false;
  drawingBoundingBox = false;

  area: string = "full";
  maxResolution: number | null = null;
  bboxLeft: number | null = null;
  bboxTop: number | null = null;
  bboxRight: number | null = null;
  bboxBottom: number | null = null;
  bboxLayer: any;
  bboxAnnotation: any;
  exportLayer: string = "all";
  format: string = "png";

  get formatList(): object[] {
    let fullList = [
      { name: "PNG", key: "png" },
      { name: "JPEG - Quality 95", key: "jpeg-95" },
      { name: "JPEG - Quality 90", key: "jpeg-90" },
      { name: "JPEG - Quality 80", key: "jpeg-80" },
      { name: "TIFF", key: "tiff" }
    ];
    if (this.area === "screen") {
      return fullList.slice(0, fullList.length - 1);
    }
    return fullList;
  }

  get isUnrolled(): boolean {
    return store.unrollZ || store.unrollXY || store.unrollT;
  }

  isRotated(): boolean {
    const map = Vue.prototype.$currentMap;
    return map && !!map.rotation();
  }

  get layerList(): object[] {
    let results = [{ name: "All", key: "all" }];
    if (store.configuration && store.configuration.layers) {
      store.configuration.layers.forEach((layer, idx) => {
        if (layer.visible) {
          results.push({ name: layer.name, key: "" + idx });
        }
      });
    }
    return results;
  }

  getBasicDownloadParams() {
    let w = store.dataset!.width;
    let h = store.dataset!.height;
    let params: any = {
      encoding:
        this.format === "png"
          ? "PNG"
          : this.format === "tiff"
          ? "TILED"
          : "JPEG",
      contentDisposition: "attachment"
    };
    if (this.format !== "png") {
      params.jpeqQuality = parseInt(this.format.substr(5), 10);
    }
    if (this.area === "view") {
      const bounds = Vue.prototype.$currentMap.bounds();
      params.left = Math.max(0, Math.round(bounds.left));
      params.right = Math.min(w, Math.round(bounds.right));
      params.top = Math.max(0, Math.round(bounds.top));
      params.bottom = Math.min(h, Math.round(bounds.bottom));
      w = params.right - params.left;
      h = params.bottom - params.top;
    } else if (this.area === "bbox") {
      params.left = this.bboxLeft;
      params.right = this.bboxRight;
      params.top = this.bboxTop;
      params.bottom = this.bboxBottom;
      w = params.right - params.left;
      h = params.bottom - params.top;
    }
    let max = Math.max(w, h);
    if (this.format !== "tiff") {
      Math.min(max, Math.min(this.maxResolution || 1e8, 10000));
    }
    params.width = max;
    params.height = max;
    return params;
  }

  getDownload() {
    if (this.area === "screen") {
      let opts: any = {
        type: this.format === "png" ? "image/png" : "image/jpeg",
        wait: "idle"
      };
      if (this.format !== "png") {
        opts.encoderOptions = parseInt(this.format.substr(5), 10) * 0.01;
      }
      opts.layers = Vue.prototype.$currentMap
        .layers()
        .filter((l: any) => l instanceof geojs.osmLayer);
      opts.layers = opts.layers.filter((_l: any, i: number) => {
        var layerIndex = Math.floor(i / 2);
        if (
          !(i % 2) ||
          (this.exportLayer !== "all" &&
            layerIndex != parseInt(this.exportLayer))
        ) {
          return false;
        }
        return store.configuration!.layers[layerIndex].visible;
      });
      Vue.prototype.$currentMap.screenshot(opts).then((res: any) => {
        const link = document.createElement("a");
        link.href = res;
        link.download = "screenshot." + (this.format === "png" ? "png" : "jpg");
        link.click();
        URL.revokeObjectURL(res);
      });
      return;
    }
    let url = store.layerStackImages[0].urls[0].split("/zxy/")[0] + "/region";
    let params = this.getBasicDownloadParams();
    let bands: any = [];
    store.configuration!.layers.forEach((layer, idx) => {
      if (
        layer.visible &&
        (this.exportLayer === "all" || parseInt(this.exportLayer) === idx)
      ) {
        let suburl = store.layerStackImages[idx].urls[0].split("?")[1];
        let q: any = {};
        suburl.split("&").forEach((e: string) => {
          let pair = e.split("=");
          q[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
        });
        let bandstyle = JSON.parse(q.style);
        bandstyle.frame = parseInt(q.frame, 10);
        bands.push(bandstyle);
      }
    });
    params.style = JSON.stringify({ bands: bands });
    let queryParts: string[] = Object.entries(params).map(
      e => encodeURIComponent(e[0]) + "=" + encodeURIComponent("" + e[1])
    );
    url += "?" + queryParts.join("&");
    const link = document.createElement("a");
    link.download = "screenshot." + (this.format === "png" ? "png" : "jpg");
    link.href = url;
    link.click();
  }

  showDialog(show: boolean) {
    if (this.drawingBoundingBox) {
      return this.doneBoundingBox();
    }
    this.dialog = show;
    const map = Vue.prototype.$currentMap;
    if (show) {
      const bounds = map.bounds();
      const w = store.dataset!.width;
      const h = store.dataset!.height;
      this.bboxLeft = Math.max(0, Math.round(bounds.left));
      this.bboxRight = Math.min(w, Math.round(bounds.right));
      this.bboxTop = Math.max(0, Math.round(bounds.top));
      this.bboxBottom = Math.min(h, Math.round(bounds.bottom));
      if (!this.bboxLayer) {
        this.bboxLayer = map.createLayer("annotation", {
          autoshareRenderer: false
        });
        this.bboxAnnotation = geojs.annotation.rectangleAnnotation({
          layer: this.bboxLayer,
          corners: [
            { x: this.bboxLeft, y: this.bboxTop },
            { x: this.bboxRight, y: this.bboxTop },
            { x: this.bboxRight, y: this.bboxBottom },
            { x: this.bboxLeft, y: this.bboxBottom }
          ],
          editHandleStyle: {
            handles: { rotate: false }
          },
          editStyle: {
            fillOpacity: 0.125,
            strokeColor: { r: 0, g: 0, b: 1 },
            strokeWidth: 2
          },
          style: {
            fillOpacity: 0.125,
            strokeColor: { r: 0, g: 0, b: 1 },
            strokeWidth: 2
          }
        });
        this.bboxLayer.addAnnotation(this.bboxAnnotation);
        map.draw();
      }
    } else {
      if (this.bboxLayer) {
        map.deleteLayer(this.bboxLayer);
        this.bboxLayer = null;
        this.bboxAnnotation = null;
        map.draw();
      }
    }
  }

  get totalArea() {
    // this updates the shown screenshot area
    let w = store.dataset!.width;
    let h = store.dataset!.height;
    let params = this.getBasicDownloadParams();
    let coordinates = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h }
    ];
    if (params.left !== undefined) {
      coordinates = [
        { x: params.left, y: params.top },
        { x: params.right, y: params.top },
        { x: params.right, y: params.bottom },
        { x: params.left, y: params.bottom }
      ];
    }
    if (this.bboxLayer && this.bboxAnnotation) {
      this.bboxLayer.visible(this.area !== "screen");
      const map = Vue.prototype.$currentMap;
      coordinates = geojs.transform.transformCoordinates(
        map.ingcs(),
        map.gcs(),
        coordinates
      );
      this.bboxAnnotation.options("corners", coordinates).draw();
    }
    return w * h;
  }

  drawBoundingBox() {
    this.area = "bbox";
    this.dialog = false;
    this.drawingBoundingBox = true;
    this.bboxLayer.mode(this.bboxLayer.modes.edit, this.bboxAnnotation).draw();
    const map = Vue.prototype.$currentMap;
    map.geoOn(geojs.event.annotation.mode, this.doneBoundingBox);
  }

  doneBoundingBox() {
    let w = store.dataset!.width;
    let h = store.dataset!.height;
    const map = Vue.prototype.$currentMap;
    map.geoOff(geojs.event.annotation.mode, this.doneBoundingBox);
    const coord = this.bboxAnnotation.coordinates();
    this.bboxLeft = Math.max(0, Math.round(Math.min(coord[0].x, coord[2].x)));
    this.bboxTop = Math.max(0, Math.round(Math.min(coord[0].y, coord[2].y)));
    this.bboxRight = Math.min(w, Math.round(Math.max(coord[0].x, coord[2].x)));
    this.bboxBottom = Math.min(h, Math.round(Math.max(coord[0].y, coord[2].y)));
    // this.bboxLayer.removeAnnotation(this.bboxAnnotation);
    this.bboxLayer.mode(null).draw();
    // this.bboxAnnotation = null;
    this.dialog = true;
    this.drawingBoundingBox = false;
  }
}
</script>

<style lang="scss" scoped>
.snapshots {
  margin-right: 1em;

  &.dark {
    color: white;
  }

  .group_label {
    margin-right: 1em;
  }
}
</style>