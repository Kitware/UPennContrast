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
          Snapshot View
        </v-card-title>
        <v-card-text
          class="pb-0"
          title="Add a name, description, or tags to filter the list of snapshots or to create a new snapshot."
        >
          <v-row>
            <v-col cols="8" class="py-0">
              <v-select
                v-model="selectedSnapshot"
                :items="snapshotList()"
                label="Current snapshot"
                item-text="name"
                item-value="key"
                dense
              ></v-select>
            </v-col>
            <v-col cols="4" class="py-0">
              <v-btn
                color="primary"
                text
                @click="loadSnapshot"
                :disabled="!selectedSnapshot || selectedSnapshot === '__none__'"
              >
                Load View
              </v-btn>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="8" class="py-0">
              <v-btn color="primary" text :to="snapshotRoute">
                {{ store.snapshot }}
              </v-btn>
            </v-col>
            <v-col cols="4" class="py-0">
              <v-btn
                color="primary"
                text
                @click="removeSnapshot"
                :disabled="!selectedSnapshot || selectedSnapshot === '__none__'"
              >
                Delete View
              </v-btn>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="8" class="py-0">
              <!-- add :rules="validationFunc" -->
              <v-text-field
                label="Snapshot name"
                v-model="newName"
                dense
              ></v-text-field>
            </v-col>
            <v-col cols="4" class="py-0">
              <v-btn
                color="primary"
                text
                :disabled="!newName.trim()"
                @click="saveSnapshot"
              >
                Save View
              </v-btn>
            </v-col>
          </v-row>
          <v-row>
            <v-col class="py-0">
              <!-- render existing tags here -->
              <v-text-field label="Tags" v-model="newTag" dense></v-text-field>
            </v-col>
          </v-row>
          <v-row>
            <v-col class="py-0">
              <v-text-field
                label="Snapshot description"
                v-model="newDescription"
                dense
              ></v-text-field>
            </v-col>
          </v-row>
          <div class="group-label" :totalarea="markCurrentArea()">
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
        </v-card-text>

        <v-divider></v-divider>

        <v-card-title class="headline">
          Download
        </v-card-title>
        <v-card-text class="pb-0">
          <v-row>
            <v-col class="pa-2">
              <v-text-field
                label="Maximum resolution"
                :disabled="area == 'screen'"
                v-model="maxResolution"
                type="number"
                :max="
                  Math.min(
                    format === 'tiled' ? 1e8 : 10000,
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

  newName: string = "";
  newDescription: string = "";
  newTag: string = "";
  newTags: string[] = [];
  selectedSnapshot: string = store.snapshot || "__none__";

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
      { name: "TIFF", key: "tiff" },
      { name: "TIFF - Tiled (for huge images)", key: "tiled" }
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
          ? "TIFF"
          : this.format === "tiled"
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
    if (this.format !== "tiled") {
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
      const screenBounds = map.gcsToDisplay([
        { x: bounds.left, y: bounds.top },
        { x: bounds.right, y: bounds.bottom }
      ]);
      const shrinkIn = 20;
      const innerBounds = map.displayToGcs([
        { x: screenBounds[0].x + shrinkIn, y: screenBounds[0].y + shrinkIn },
        { x: screenBounds[1].x - shrinkIn, y: screenBounds[1].y - shrinkIn }
      ]);
      this.bboxLeft = Math.max(0, Math.round(innerBounds[0].x));
      this.bboxRight = Math.min(w, Math.round(innerBounds[1].x));
      this.bboxTop = Math.max(0, Math.round(innerBounds[0].y));
      this.bboxBottom = Math.min(h, Math.round(innerBounds[1].y));
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
            strokeColor: { r: 1, g: 0, b: 0 },
            handles: { rotate: false }
          },
          editStyle: {
            fillOpacity: 0,
            strokeColor: { r: 1, g: 0, b: 0 },
            strokeWidth: 2
          },
          style: {
            fillOpacity: 0,
            strokeColor: { r: 1, g: 0, b: 0 },
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

  markCurrentArea() {
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
    this.markCurrentArea();
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
    this.bboxLayer.mode(null).draw();
    this.dialog = true;
    this.drawingBoundingBox = false;
  }

  snapshotList(): object[] {
    let results = [{ name: "None", key: "__none__" }];
    if (store.configuration && store.configuration.snapshots) {
      store.configuration.snapshots.forEach(s => {
        results.push({ name: s.name, key: s.name });
      });
    }
    return results;
  }

  async loadSnapshot() {
    var snapshot = await this.store.loadSnapshot(this.selectedSnapshot);
    this.newName = snapshot.name || "";
    this.newDescription = snapshot.description || "";
    this.newTags = snapshot.tags!.slice();
    this.area = snapshot.screenshot!.area;
    this.format = snapshot.screenshot!.format;
    this.bboxLeft = snapshot.screenshot!.bbox!.left;
    this.bboxTop = snapshot.screenshot!.bbox!.top;
    this.bboxRight = snapshot.screenshot!.bbox!.right;
    this.bboxBottom = snapshot.screenshot!.bbox!.bottom;
    this.maxResolution = snapshot.screenshot!.maxResolution;
    /*
    const map = Vue.prototype.$currentMap;
    map.bounds({
      left: Math.min(
        snapshot.viewport.tl.x,
        snapshot.viewport.tr.x,
        snapshot.viewport.bl.x,
        snapshot.viewport.tr.x
      ),
      right: Math.max(
        snapshot.viewport.tl.x,
        snapshot.viewport.tr.x,
        snapshot.viewport.bl.x,
        snapshot.viewport.tr.x
      ),
      top: Math.max(
        snapshot.viewport.tl.y,
        snapshot.viewport.tr.y,
        snapshot.viewport.bl.y,
        snapshot.viewport.tr.y
      ),
      bottom: Math.min(
        snapshot.viewport.tl.y,
        snapshot.viewport.tr.y,
        snapshot.viewport.bl.y,
        snapshot.viewport.tr.y
      )
    });
    map.rotation(snapshot.rotation || 0);
    */
  }

  saveSnapshot(): void {
    if (!this.newName.trim()) {
      return;
    }
    const map = Vue.prototype.$currentMap;
    let params = this.getBasicDownloadParams();
    let snapshot = {
      name: this.newName.trim(),
      description: this.newDescription.trim(),
      tags: this.newTags.slice(),
      created: Date.now(),
      viewport: {
        tl: map.displayToGcs({ x: 0, y: 0 }),
        tr: map.displayToGcs({ x: map.size().width, y: 0 }),
        bl: map.displayToGcs({ x: 0, y: map.size().height }),
        br: map.displayToGcs({ x: map.size().width, y: map.size().height })
      },
      rotation: map.rotation(),
      unrollXY: store.unrollXY,
      unrollZ: store.unrollZ,
      unrollT: store.unrollT,
      xy: store.xy,
      z: store.z,
      time: store.time,
      layerMode: store.layerMode,
      layers: store.configuration!.layers.map(l =>
        Object.fromEntries(
          Object.entries(l).filter(([k]) => !k.startsWith("_"))
        )
      ),
      screenshot: {
        area: this.area,
        format: this.format,
        bbox: {
          left: this.bboxLeft,
          top: this.bboxTop,
          right: this.bboxRight,
          bottom: this.bboxBottom
        },
        maxResolution: this.maxResolution
      }
    };
    this.store.addSnapshot(snapshot);
  }

  removeSnapshot(): void {
    this.store.removeSnapshot(this.selectedSnapshot);
    this.selectedSnapshot = "__none__";
  }

  get snapshotRoute(): string {
    // DWM::
    console.log("snapshotRoute");
    return "";
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
