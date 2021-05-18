<template>
  <div class="snapshots">
    <div v-if="store.configuration">
      <v-card-title class="headline">
        Snapshot
      </v-card-title>
      <v-card-text
        class="pb-0"
        title="Add a name, description, or tags to filter the list of snapshots or to create a new snapshot."
      >
        <v-row>
          <v-col cols="7" class="py-0">
            <v-select
              v-model="selectedSnapshot"
              :items="snapshotList()"
              label="Current snapshot"
              item-text="name"
              item-value="key"
              dense
            ></v-select>
          </v-col>
          <v-col cols="5" class="py-0">
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
          <v-col cols="7" class="py-0">
            <v-btn color="primary" text :to="snapshotRoute">
              {{ store.snapshot }}
            </v-btn>
          </v-col>
          <v-col cols="5" class="py-0">
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
          <v-col cols="7" class="py-0">
            <!-- add :rules="validationFunc" -->
            <v-text-field
              label="Snapshot name"
              v-model="newName"
              dense
            ></v-text-field>
          </v-col>
          <v-col cols="5" class="py-0">
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
        <div class="group-label" :currentArea="markCurrentArea()">
          Resolution and Area:
        </div>
        <v-row>
          <v-col class="py-0">
            <v-btn
              color="primary"
              text
              @click="setArea('viewport')"
              :disabled="isRotated()"
            >
              Viewport
            </v-btn>
          </v-col>
          <v-col class="py-0">
            <v-btn color="primary" text @click="setArea('full')">
              Full
            </v-btn>
          </v-col>
        </v-row>
        <v-row>
          <v-col class="pa-2">
            <v-text-field
              label="Left"
              v-model="bboxLeft"
              type="number"
              :max="store.dataset.width"
              dense
            ></v-text-field>
          </v-col>
          <v-col class="pa-2">
            <v-text-field
              label="Top"
              v-model="bboxTop"
              type="number"
              :max="store.dataset.height"
              dense
            ></v-text-field>
          </v-col>
          <v-col class="pa-2">
            <v-text-field
              label="Right"
              v-model="bboxRight"
              type="number"
              :max="store.dataset.width"
              dense
            ></v-text-field>
          </v-col>
          <v-col class="pa-2">
            <v-text-field
              label="Bottom"
              v-model="bboxBottom"
              type="number"
              :max="store.dataset.height"
              dense
            ></v-text-field>
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
          @click="getDownload()"
          :disabled="isUnrolled"
        >
          Download
        </v-btn>
      </v-card-actions>
    </div>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import store from "@/store";
import geojs from "geojs";

@Component
export default class Snapshots extends Vue {
  readonly store = store;

  @Prop()
  snapshotVisible!: boolean;

  @Watch("snapshotVisible")
  watchSnapshotVisible(_value: boolean) {
    this.showSnapshot(this.snapshotVisible);
    if (this.snapshotVisible) {
      this.markCurrentArea();
      this.drawBoundingBox();
    }
  }

  newName: string = "";
  newDescription: string = "";
  newTag: string = "";
  newTags: string[] = [];
  selectedSnapshot: string = store.snapshot || "__none__";

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
    params.left = this.bboxLeft;
    params.right = this.bboxRight;
    params.top = this.bboxTop;
    params.bottom = this.bboxBottom;
    w = params.right - params.left;
    h = params.bottom - params.top;
    let max = Math.max(w, h);
    if (this.format !== "tiled") {
      Math.min(max, Math.min(this.maxResolution || 1e8, 10000));
    }
    params.width = max;
    params.height = max;
    return params;
  }

  getDownload() {
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

  showSnapshot(show: boolean) {
    const map = Vue.prototype.$currentMap;
    if (show && map) {
      const bounds = map.bounds();
      const w = store.dataset!.width;
      const h = store.dataset!.height;
      if (this.bboxLeft === null) {
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
      }
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
        this.doneBoundingBox(true);
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
      this.bboxLayer.visible(true);
      const map = Vue.prototype.$currentMap;
      coordinates = geojs.transform.transformCoordinates(
        map.ingcs(),
        map.gcs(),
        coordinates
      );
      this.bboxAnnotation.options("corners", coordinates);
      console.log(this.bboxLayer.currentAnnotation, params); //DWM::
      if (this.bboxLayer.currentAnnotation) {
        this.bboxLayer.currentAnnotation.options("corners", coordinates);
      }
      this.bboxLayer.draw();
    }
    return w * h;
  }

  setArea(mode: string) {
    const map = Vue.prototype.$currentMap;
    if (mode === "full" && store.dataset) {
      this.bboxLeft = 0;
      this.bboxTop = 0;
      this.bboxRight = store.dataset.width;
      this.bboxBottom = store.dataset.height;
    } else if (mode === "viewport" && map && store.dataset) {
      const bounds = map.bounds();
      this.bboxLeft = Math.max(0, Math.round(bounds.left));
      this.bboxTop = Math.max(0, Math.round(bounds.top));
      this.bboxRight = Math.min(store.dataset.width, Math.round(bounds.right));
      this.bboxBottom = Math.min(
        store.dataset.height,
        Math.round(bounds.bottom)
      );
    }
    this.markCurrentArea();
  }

  drawBoundingBox() {
    // DWM::
    this.bboxLayer.mode(null);
    this.bboxLayer.mode(this.bboxLayer.modes.edit, this.bboxAnnotation).draw();
    const map = Vue.prototype.$currentMap;
    map.geoOff(geojs.event.annotation.mode, this.doneBoundingBox);
    map.geoOff(geojs.event.annotation.coordinates, this.boundingBoxCoordinates);
    map.geoOn(geojs.event.annotation.mode, this.doneBoundingBox);
    map.geoOn(geojs.event.annotation.coordinates, this.boundingBoxCoordinates);
    this.markCurrentArea();
  }

  boundingBoxCoordinates(event: { [key: string]: any }) {
    let w = store.dataset!.width;
    let h = store.dataset!.height;
    const coord = event.annotation!.coordinates();
    this.bboxLeft = Math.max(0, Math.round(Math.min(coord[0].x, coord[2].x)));
    this.bboxTop = Math.max(0, Math.round(Math.min(coord[0].y, coord[2].y)));
    this.bboxRight = Math.min(w, Math.round(Math.max(coord[0].x, coord[2].x)));
    this.bboxBottom = Math.min(h, Math.round(Math.max(coord[0].y, coord[2].y)));
  }

  doneBoundingBox(allDone: boolean) {
    let w = store.dataset!.width;
    let h = store.dataset!.height;
    const map = Vue.prototype.$currentMap;
    map.geoOff(geojs.event.annotation.mode, this.doneBoundingBox);
    map.geoOff(geojs.event.annotation.coordinates, this.boundingBoxCoordinates);
    const coord = this.bboxAnnotation.coordinates();
    this.bboxLeft = Math.max(0, Math.round(Math.min(coord[0].x, coord[2].x)));
    this.bboxTop = Math.max(0, Math.round(Math.min(coord[0].y, coord[2].y)));
    this.bboxRight = Math.min(w, Math.round(Math.max(coord[0].x, coord[2].x)));
    this.bboxBottom = Math.min(h, Math.round(Math.max(coord[0].y, coord[2].y)));
    this.bboxLayer.mode(null).draw();
    if (allDone !== true) {
      this.drawBoundingBox();
    }
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
    this.format = snapshot.screenshot!.format;
    this.bboxLeft = snapshot.screenshot!.bbox!.left;
    this.bboxTop = snapshot.screenshot!.bbox!.top;
    this.bboxRight = snapshot.screenshot!.bbox!.right;
    this.bboxBottom = snapshot.screenshot!.bbox!.bottom;
    this.maxResolution = snapshot.screenshot!.maxResolution;

    this.$router
      .replace({
        query: {
          ...this.$route.query,
          unrollXY: snapshot.unrollXY,
          unrollZ: snapshot.unrollZ,
          unrollT: snapshot.unrollT,
          xy: snapshot.xy,
          z: snapshot.z,
          time: snapshot.time,
          layer: snapshot.layerMode
        }
      })
      .catch(() => {}); /* catch redundant navigation warnings */

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
      top: Math.min(
        snapshot.viewport.tl.y,
        snapshot.viewport.tr.y,
        snapshot.viewport.bl.y,
        snapshot.viewport.tr.y
      ),
      bottom: Math.max(
        snapshot.viewport.tl.y,
        snapshot.viewport.tr.y,
        snapshot.viewport.bl.y,
        snapshot.viewport.tr.y
      )
    });
    map.rotation(snapshot.rotation || 0);
    this.markCurrentArea();
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
