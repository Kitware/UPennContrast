<template>
  <div class="snapshots mx-0">
    <div v-if="store.configuration">
      <v-card-title class="headline">
        Snapshot
      </v-card-title>
      <v-card-text
        class="pb-0"
        title="Add a name, description, or tags to filter the list of snapshots or to create a new snapshot."
      >
        <v-row>
          <v-col cols="8" class="py-0">
            <!-- add :rules="validationFunc" -->
            <v-text-field
              label="Snapshot name"
              v-model="newName"
              dense
              hide-details
            ></v-text-field>
          </v-col>
          <v-col cols="4" class="py-0">
            <v-btn
              color="primary"
              text
              :disabled="!newName.trim()"
              @click="saveSnapshot"
            >
              Save
            </v-btn>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="8" class="py-0">
            <span v-if="modifiedDate" id="modified-date">
              Last change: {{ new Date(modifiedDate).toLocaleString() }}
            </span>
          </v-col>
          <v-col cols="4" class="py-0">
            <v-btn
              color="primary"
              text
              @click="removeSnapshot"
              :disabled="!currentSnapshot"
            >
              Delete
            </v-btn>
          </v-col>
        </v-row>
        <v-row>
          <v-col class="py-0">
            <v-combobox
              v-model="newTags"
              :items="tagList()"
              :search-input.sync="tagSearchInput"
              @change="tagSearchInput = ''"
              label="Tags"
              multiple
              hide-selected
              small-chips
              dense
            >
              <template v-slot:selection="{ attrs, index, item, parent }">
                <v-chip
                  class="pa-2"
                  v-bind="attrs"
                  close
                  small
                  @click:close="parent.selectItem(item)"
                >
                  {{ item }}
                </v-chip>
              </template>
            </v-combobox>
          </v-col>
        </v-row>
        <v-row>
          <v-col class="py-0">
            <v-text-field
              label="Snapshot description"
              v-model="newDescription"
              dense
              hide-details
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
              hide-details
            ></v-text-field>
          </v-col>
          <v-col class="pa-2">
            <v-text-field
              label="Top"
              v-model="bboxTop"
              type="number"
              :max="store.dataset.height"
              dense
              hide-details
            ></v-text-field>
          </v-col>
          <!--
          <v-col class="pa-2">
            <v-text-field
              label="Right"
              v-model="bboxRight"
              type="number"
              :max="store.dataset.width"
              dense
              hide-details
            ></v-text-field>
          </v-col>
          <v-col class="pa-2">
            <v-text-field
              label="Bottom"
              v-model="bboxBottom"
              type="number"
              :max="store.dataset.height"
              dense
              hide-details
            ></v-text-field>
          </v-col>
          -->
          <v-col class="pa-2">
            <v-text-field
              label="Width"
              v-model="bboxWidth"
              type="number"
              :max="store.dataset.width"
              dense
              hide-details
            ></v-text-field>
          </v-col>
          <v-col class="pa-2">
            <v-text-field
              label="Height"
              v-model="bboxHeight"
              type="number"
              :max="store.dataset.height"
              dense
              hide-details
            ></v-text-field>
          </v-col>
        </v-row>
      </v-card-text>

      <v-divider></v-divider>

      <v-card-text class="pa-0">
        <v-data-table
          :items="snapshotList()"
          :headers="tableHeaders"
          :items-per-page="5"
          item-key="key"
          class="accent-1"
          @click:row="(item, unused) => loadSnapshot(item.name)"
        >
          <!-- Search bar -->
          <template v-slot:top>
            <v-text-field
              label="Search Snapshots"
              v-model="snapshotSearch"
              clearable
              hide-details
              class="ma-2"
            />
          </template>
          <!-- Tags -->
          <template v-slot:item.tags="{ item }">
            <v-chip
              v-for="t in item.record.tags"
              :key="'tag_' + item.name + '_' + t"
              @click.stop="snapshotSearch = t"
              x-small
              >{{ t }}</v-chip
            >
          </template>
        </v-data-table>
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
              hide-details
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
              hide-details
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
              hide-details
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
import { formatDate } from "@/utils/date";

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

  tableHeaders: {
    text: string;
    value: string;
    sortable: boolean;
    sort?: (a: any, b: any) => number;
    class?: string;
  }[] = [
    { text: "Name", value: "name", sortable: true, class: "text-no-wrap" },
    {
      text: "Modified",
      value: "modified",
      sortable: true,
      sort: (a: any, b: any) => Date.parse(a) - Date.parse(b),
      class: "text-no-wrap"
    },
    { text: "Tags", value: "tags", sortable: false, class: "text-no-wrap" }
  ];

  newName: string = "";
  newDescription: string = "";
  newTags: string[] = [];
  tagSearchInput: string = "";

  snapshotSearch: string = "";

  maxResolution: number | null = null;
  bboxLeft: number | null = null;
  bboxTop: number | null = null;
  bboxRight: number | null = null;
  bboxBottom: number | null = null;
  bboxLayer: any;
  bboxAnnotation: any;
  exportLayer: string = "all";
  format: string = "png";

  get bboxWidth(): number {
    return (this.bboxRight || 0) - (this.bboxLeft || 0);
  }

  set bboxWidth(value: number) {
    this.bboxRight = (this.bboxLeft || 0) + parseInt("" + value, 10);
  }

  get bboxHeight(): number {
    return (this.bboxBottom || 0) - (this.bboxTop || 0);
  }

  set bboxHeight(value: number) {
    this.bboxBottom = (this.bboxTop || 0) + parseInt("" + value, 0);
  }

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

    // Determine fileName
    const datasetName = store.dataset?.name || "unknown";
    const configurationName = store.configuration?.name || "unknown";
    const snapshotName = this.newName ? `-${this.newName}` : "";
    const dateStr = formatDate(new Date());
    const extension = this.format === "png" ? "png" : "jpg";
    // Should be dataset-configuration-snapshot-date
    const fileName = `${datasetName}-${configurationName}${snapshotName}-${dateStr}.${extension}`;

    let params: any = {
      encoding:
        this.format === "png"
          ? "PNG"
          : this.format === "tiff"
          ? "TIFF"
          : this.format === "tiled"
          ? "TILED"
          : "JPEG",
      contentDisposition: "attachment",
      contentDispositionFilename: fileName
    };
    if (this.format !== "png") {
      params.jpeqQuality = parseInt(this.format.substr(5), 10);
    }
    params.left = this.bboxLeft;
    params.top = this.bboxTop;
    params.right = this.bboxRight;
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

  setBoundingBox(left: number, top: number, right: number, bottom: number) {
    const w = store.dataset!.width;
    const h = store.dataset!.height;
    this.bboxLeft = Math.min(w - 1, Math.max(0, Math.round(left)));
    this.bboxRight = Math.max(
      this.bboxLeft + 1,
      Math.min(w, Math.round(right))
    );
    this.bboxTop = Math.min(h - 1, Math.max(0, Math.round(top)));
    this.bboxBottom = Math.max(
      this.bboxTop + 1,
      Math.min(h, Math.round(bottom))
    );
  }

  showSnapshot(show: boolean) {
    const map = Vue.prototype.$currentMap;
    if (show && map) {
      const bounds = map.bounds();
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
        this.setBoundingBox(
          innerBounds[0].x,
          innerBounds[0].y,
          innerBounds[1].x,
          innerBounds[1].y
        );
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
      this.setBoundingBox(0, 0, store.dataset.width, store.dataset.height);
    } else if (mode === "viewport" && map && store.dataset) {
      const bounds = map.bounds();
      this.setBoundingBox(bounds.left, bounds.top, bounds.right, bounds.bottom);
    }
    this.markCurrentArea();
  }

  drawBoundingBox() {
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
    const coord = event.annotation!.coordinates();
    this.setBoundingBox(
      Math.min(coord[0].x, coord[2].x),
      Math.min(coord[0].y, coord[2].y),
      Math.max(coord[0].x, coord[2].x),
      Math.max(coord[0].y, coord[2].y)
    );
  }

  doneBoundingBox(allDone: boolean) {
    const map = Vue.prototype.$currentMap;
    map.geoOff(geojs.event.annotation.mode, this.doneBoundingBox);
    map.geoOff(geojs.event.annotation.coordinates, this.boundingBoxCoordinates);
    const coord = this.bboxAnnotation.coordinates();
    this.setBoundingBox(
      Math.min(coord[0].x, coord[2].x),
      Math.min(coord[0].y, coord[2].y),
      Math.max(coord[0].x, coord[2].x),
      Math.max(coord[0].y, coord[2].y)
    );
    this.bboxLayer.mode(null).draw();
    if (allDone !== true) {
      this.drawBoundingBox();
    }
  }

  snapshotList(sortMode?: string): { [key: string]: any }[] {
    let sre = new RegExp(this.snapshotSearch || "", "i");
    let results: { [key: string]: any }[] = [];
    if (store.configuration && store.configuration.snapshots) {
      let snapshots = store.configuration.snapshots.slice();
      if (!sortMode) {
        snapshots.sort(
          (a, b) => (b.modified || b.created) - (a.modified || a.created)
        );
      }
      snapshots.forEach(s => {
        if (
          sre.exec(s.name) ||
          sre.exec(s.description) ||
          s.tags.some((t: string) => sre.exec(t))
        ) {
          results.push({
            name: s.name,
            key: s.name,
            record: s,
            // format the date to string
            modified: formatDate(new Date(s.modified || s.created))
          });
        }
      });
    }
    return results;
  }

  tagList(): string[] {
    const tagSet: { [key: string]: any } = {};
    if (store.configuration && store.configuration.snapshots) {
      store.configuration.snapshots.forEach(s => {
        (s.tags || []).forEach((tag: string) => {
          tagSet[tag] = true;
        });
      });
    }
    let tags = Object.keys(tagSet).sort();
    return tags;
  }

  async loadSnapshot(name: string) {
    var snapshot = await this.store.loadSnapshot(name);
    this.newName = snapshot.name || "";
    this.newDescription = snapshot.description || "";
    this.newTags = (snapshot.tags || []).slice();
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
      created: this.currentSnapshot ? this.currentSnapshot.created : Date.now(),
      modified: Date.now(),
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
    this.store.removeSnapshot(this.newName);
  }

  get currentSnapshot(): { [key: string]: any } | undefined {
    if (store.configuration && store.configuration.snapshots) {
      return store.configuration.snapshots
        .slice()
        .filter(s => s.name === this.newName)[0];
    }
    return;
  }

  get modifiedDate(): number {
    const snapshot = this.currentSnapshot;
    if (snapshot) {
      return snapshot.modified || snapshot.created;
    }
    return 0;
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
#modified-date {
  font-size: 10px;
}
</style>
