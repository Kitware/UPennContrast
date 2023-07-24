<template>
  <div>
    <v-card v-if="store.configuration">
      <v-card-title class="headline">
        Snapshot
      </v-card-title>

      <v-dialog v-model="imageTooBigDialog">
        <v-alert class="ma-0" type="error">
          <div class="title">
            Image can't be downloaded
          </div>
          <div class="ma-2">
            Image size can't exceed {{ maxPixels }} pixels.<br />
            When downloading raw channels, subsampling is not allowed.<br />
            Downloading layers allows subsampling image to
            {{ maxPixels }} pixels if the image is too big.
          </div>
          <div class="d-flex">
            <v-spacer />
            <v-btn @click="imageTooBigDialog = false">OK</v-btn>
          </div>
        </v-alert>
      </v-dialog>

      <v-card-text>
        <v-row justify="center">
          <v-dialog v-model="createDialog">
            <template v-slot:activator="{ on, attrs }">
              <v-btn color="primary" v-on="on" v-bind="attrs">
                Save as Snapshot...
              </v-btn>
            </template>
            <v-card>
              <v-card-title>
                Create New Snapshot
              </v-card-title>
              <v-form
                lazy-validation
                ref="saveSnapshotForm"
                @input="updateFormValidation"
                @submit="saveSnapshot"
              >
                <v-card-text
                  title="Add a name, description, or tags to create a new snapshot."
                >
                  <v-row>
                    <v-col>
                      <v-text-field
                        label="Snapshot name"
                        v-model="newName"
                        dense
                        hide-details
                        autofocus
                        :rules="nameRules"
                        required
                      />
                    </v-col>
                  </v-row>
                  <v-row>
                    <v-col>
                      <tag-picker v-model="newTags" />
                    </v-col>
                  </v-row>
                  <v-row>
                    <v-col>
                      <v-text-field
                        label="Snapshot description"
                        v-model="newDescription"
                        dense
                        hide-details
                      />
                    </v-col>
                  </v-row>
                </v-card-text>
                <v-card-actions>
                  <v-spacer />
                  <v-btn
                    color="primary"
                    :disabled="!isSaveSnapshotValid"
                    type="submit"
                  >
                    Create
                  </v-btn>
                </v-card-actions>
              </v-form>
            </v-card>
          </v-dialog>
        </v-row>
        <v-row :currentArea="markCurrentArea()">
          <v-col class="title">
            Resolution and Area:
          </v-col>
        </v-row>
        <v-row v-if="store.dataset">
          <v-col>
            <v-text-field
              label="Left"
              v-model="bboxLeft"
              type="number"
              :max="store.dataset.width"
              dense
              hide-details
            />
          </v-col>
          <v-col>
            <v-text-field
              label="Top"
              v-model="bboxTop"
              type="number"
              :max="store.dataset.height"
              dense
              hide-details
            />
          </v-col>
          <v-col>
            <v-text-field
              label="Width"
              v-model="bboxWidth"
              type="number"
              :max="store.dataset.width"
              dense
              hide-details
            />
          </v-col>
          <v-col>
            <v-text-field
              label="Height"
              v-model="bboxHeight"
              type="number"
              :max="store.dataset.height"
              dense
              hide-details
            />
          </v-col>
        </v-row>
        <v-row justify="center">
          <v-btn
            class="my-2"
            @click="setArea('viewport')"
            :disabled="isRotated()"
          >
            Set frame to current viewport
          </v-btn>
          <v-btn class="my-2" @click="setArea('full')">
            Set frame to maximum
          </v-btn>
        </v-row>
      </v-card-text>

      <v-divider />

      <v-card-text>
        <v-data-table
          :items="snapshotList()"
          :headers="tableHeaders"
          :items-per-page="5"
          item-key="key"
          class="accent-1"
          @click:row="loadSnapshot"
        >
          <!-- Search bar -->
          <template v-slot:top>
            <v-text-field
              label="Filter by name..."
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
          <!-- Delete icon -->
          <template v-slot:item.delete="{ item }">
            <v-btn
              fab
              small
              color="red"
              @click.stop="removeSnapshot(item.name)"
            >
              <v-icon>mdi-trash-can</v-icon>
            </v-btn>
          </template>
        </v-data-table>
      </v-card-text>

      <v-divider />

      <v-card-title class="headline">
        Download
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="5">
            <v-radio-group v-model="downloadMode">
              <v-radio label="Scaled Layers" value="layers" />
              <v-radio label="Raw channels" value="channels" />
            </v-radio-group>
          </v-col>
          <v-col>
            <v-select
              v-if="downloadMode === 'layers'"
              v-model="exportLayer"
              :items="layerItems"
              label="Layer"
              dense
              hide-details
            />
            <v-select
              v-if="downloadMode === 'channels'"
              v-model="exportChannel"
              :items="channelItems"
              label="Channel"
              dense
              hide-details
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-select
              v-model="format"
              :items="formatList"
              label="Format"
              dense
              hide-details
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-slider
              v-if="format === 'jpeg'"
              label="JPEG Quality"
              v-model="jpegQuality"
              min="80"
              max="95"
              step="5"
            >
              <template v-slot:append>
                <v-text-field
                  v-model="jpegQuality"
                  class="mt-0 pt-0"
                  type="number"
                  step="5"
                  style="width: 3em"
                />
              </template>
            </v-slider>
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          color="primary"
          @click="getDownload()"
          :disabled="unroll || downloading"
        >
          <v-progress-circular v-if="downloading" indeterminate />
          Download Snapshot images...
        </v-btn>
      </v-card-actions>

      <v-divider />

      <div class="d-flex pa-4 justify-center">
        <v-btn color="primary" @click="screenshotViewport()">
          Download Screenshot of Current Viewport
        </v-btn>
      </div>
    </v-card>
    <v-dialog width="min-content" v-model="layersOverwritePanel" persistent>
      <v-alert prominent type="warning" class="ma-0">
        <div>
          <v-card-title>
            Snapshot layers incompatibility
          </v-card-title>
          <v-card-text>
            The selected snapshot layers are not compatible with the current
            configuration layers. It can be because some layers have been
            removed or because layer channels have changed.
          </v-card-text>
          <v-card-actions class="d-flex justify-end">
            <v-btn @click="overwriteConfigurationLayers" color="red">
              Overwrite configuration layers
            </v-btn>
            <v-btn @click="changeDatasetViewContrasts" color="secondary">
              Try to apply contrasts anyway
            </v-btn>
            <v-btn @click="layersOverwritePanel = false" color="primary">
              Do not change layers
            </v-btn>
          </v-card-actions>
        </div>
      </v-alert>
    </v-dialog>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import TagPicker from "@/components/TagPicker.vue";
import store from "@/store";
import geojs from "geojs";
import { formatDate } from "@/utils/date";
import { downloadToClient } from "@/utils/download";
import {
  IDisplayLayer,
  IGeoJSAnnotation,
  IGeoJSLayer,
  IGeoJSMap,
  IImage,
  ISnapshot,
  copyLayerWithoutPrivateAttributes
} from "@/store/model";
import { ITileHistogram, ITileOptionsBands, toStyle } from "@/store/images";
import axios from "axios";
import { DeflateOptions, Zip, ZipDeflate } from "fflate";

interface ISnapshotItem {
  name: string;
  key: string;
  record: ISnapshot;
  modified: string;
}

interface IDownloadParameters {
  encoding: string;
  contentDisposition: string;
  contentDispositionFilename: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  jpeqQuality?: number;
  style?: string;
  tiffCompression?: string;
}

function intFromString(value: string) {
  const parsedValue = parseInt("0" + value, 10);
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
}

@Component({ components: { TagPicker } })
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
      text: "Timestamp",
      value: "modified",
      sortable: true,
      sort: (a: any, b: any) => Date.parse(a) - Date.parse(b),
      class: "text-no-wrap"
    },
    { text: "Tags", value: "tags", sortable: false, class: "text-no-wrap" },
    { text: "Delete", value: "delete", sortable: false }
  ];

  jpegQuality: number | string = 95;

  readonly maxPixels = 4_000_000;

  downloading: boolean = false;

  imageTooBigDialog: boolean = false;
  createDialog: boolean = false;
  newName: string = "";
  newDescription: string = "";
  newTags: string[] = [];
  readonly nameRules = [(name: string) => !!name.trim() || "Name is required"];
  isSaveSnapshotValid: boolean = true;

  $refs!: {
    // https://github.com/vuetifyjs/vuetify/issues/5962
    saveSnapshotForm: HTMLFormElement;
  };

  snapshotSearch: string = "";

  bboxLeft: number = 0;
  bboxTop: number = 0;
  bboxRight: number = 0;
  bboxBottom: number = 0;
  bboxLayer: IGeoJSLayer | null = null;
  bboxAnnotation: IGeoJSAnnotation | null = null;
  downloadMode: "layers" | "channels" = "layers";
  exportLayer: "all" | "composite" | string = "all";
  exportChannel: "all" | number = "all";
  format: string = "png";

  layersOverwritePanel: boolean = false;
  overwrittingSnaphot: ISnapshot | null = null;

  get formatList() {
    if (this.downloadMode === "layers") {
      return [
        { text: "PNG", value: "png" },
        { text: "JPEG", value: "jpeg" },
        { text: "TIFF", value: "tiff" },
        { text: "TIFF - Tiled (for huge images)", value: "tiled" }
      ];
    }
    if (this.downloadMode === "channels") {
      return [
        { text: "TIFF", value: "tiff" },
        { text: "TIFF - Tiled (for huge images)", value: "tiled" }
      ];
    }
    return [{ text: "Unknown download mode", value: "" }];
  }

  @Watch("downloadMode")
  downloadModeChanged() {
    this.format = this.formatList[0].value;
  }

  get bboxWidth(): number {
    return (this.bboxRight || 0) - (this.bboxLeft || 0);
  }

  set bboxWidth(value: string) {
    this.bboxRight = (this.bboxLeft || 0) + intFromString(value);
  }

  get bboxHeight(): number {
    return (this.bboxBottom || 0) - (this.bboxTop || 0);
  }

  set bboxHeight(value: string) {
    this.bboxBottom = (this.bboxTop || 0) + intFromString(value);
  }

  get unroll(): boolean {
    return store.unroll;
  }

  get geoJSMaps() {
    return this.store.maps.map(map => map.map);
  }

  get firstMap(): IGeoJSMap | undefined {
    return this.geoJSMaps[0];
  }

  isRotated(): boolean {
    return this.geoJSMaps.some(map => !!map.rotation());
  }

  get layerItems() {
    const results: {
      text: string;
      value: string;
    }[] = [
      { text: "All layers", value: "all" },
      { text: "Composite layers", value: "composite" }
    ];
    store.layers.forEach(layer => {
      if (layer.visible) {
        results.push({ text: layer.name, value: layer.id });
      }
    });
    return results;
  }

  get channelItems() {
    const results: {
      text: string;
      value: string | number;
    }[] = [{ text: "All channels", value: "all" }];
    if (this.store.dataset) {
      this.store.dataset.channels.forEach(channel => {
        results.push({
          text:
            this.store.dataset!.channelNames.get(channel) ||
            "Channel " + channel,
          value: channel
        });
      });
    }
    return results;
  }

  getBasicDownloadParams() {
    // Determine fileName
    const datasetName = store.dataset?.name || "unknown";
    const configurationName = store.configuration?.name || "unknown";
    const snapshotName = this.newName ? `-${this.newName}` : "";
    const dateStr = formatDate(new Date());
    const extension = this.format === "tiled" ? "tiff" : this.format;
    // Should be dataset-configuration-snapshot-date
    const fileName = `${datasetName}-${configurationName}${snapshotName}-${dateStr}.${extension}`;

    let params: IDownloadParameters = {
      encoding: this.format.toUpperCase(),
      contentDisposition: "attachment",
      contentDispositionFilename: fileName,
      left: this.bboxLeft,
      top: this.bboxTop,
      right: this.bboxRight,
      bottom: this.bboxBottom,
      width: 0,
      height: 0
    };
    if (this.format === "jpeg") {
      if (typeof this.jpegQuality === "string") {
        this.jpegQuality = parseInt(this.jpegQuality);
      }
      params.jpeqQuality = this.jpegQuality;
    }
    if (this.format === "tiff") {
      params.tiffCompression = "raw";
    }

    params.width = params.right - params.left;
    params.height = params.bottom - params.top;

    // Maximum 4M pixels per image
    const nPixels = params.width * params.height;
    if (nPixels > this.maxPixels) {
      if (this.downloadMode === "layers") {
        // Scale the image
        const scale = Math.sqrt(this.maxPixels / nPixels);
        params.width = Math.floor(scale * params.width);
        params.height = Math.floor(scale * params.height);
      }
      if (this.downloadMode === "channels") {
        this.imageTooBigDialog = true;
        return null;
      }
    }
    return params;
  }

  async screenshotViewport() {
    const map = this.firstMap;
    if (!map) {
      return;
    }
    const layers = map
      .layers()
      .filter(
        layer =>
          layer !== this.bboxLayer &&
          layer.node().css("visibility") !== "hidden"
      );
    map.screenshot(layers).then((image: string) => {
      const params = {
        href: image,
        download: "viewport_screenshot.png"
      };
      downloadToClient(params);
    });
  }

  async getDownload() {
    this.downloading = true;
    let urls: URL[] = [];
    if (this.downloadMode === "layers") {
      urls = await this.getLayerDownloadURLs();
    }
    if (this.downloadMode === "channels") {
      urls = this.getChannelDownloadURLs();
    }
    if (urls.length <= 0) {
      this.downloading = false;
      throw "No urls to download";
    } else if (urls.length === 1) {
      downloadToClient({ href: urls[0].href });
      this.downloading = false;
    } else {
      // Create and setup a zip object
      const zip: Zip = new Zip();
      const zipChunks: Uint8Array[] = [];
      const zipDone: Promise<Blob> = new Promise((resolve, reject) => {
        zip.ondata = (err, data, final) => {
          if (!err) {
            zipChunks.push(data);
            if (final) {
              resolve(new Blob(zipChunks));
            }
          } else {
            reject(err);
          }
        };
      });
      // Get all the files and add them to the zip
      const deflateOptions: DeflateOptions = {
        level: ["jpeg", "png"].includes(this.format) ? 0 : 9
      };
      const filenames = new Set();
      const filesPushed: Promise<void>[] = [];
      for (const url of urls) {
        // Fetch file
        const getPromise = axios.get(url.href, { responseType: "arraybuffer" });
        // Create a unique file name
        const baseFullFilename =
          url.searchParams.get("contentDispositionFilename") || "snapshot";
        const lastPointIdx = baseFullFilename.lastIndexOf(".");
        let baseFileName = baseFullFilename;
        let baseExtension = "";
        if (lastPointIdx > 0) {
          baseFileName = baseFullFilename.slice(0, lastPointIdx);
          baseExtension = baseFullFilename.slice(lastPointIdx);
        }
        let fileName = baseFileName + baseExtension;
        let counter = 1;
        while (filenames.has(fileName)) {
          fileName = baseFileName + " (" + counter + ")" + baseExtension;
          counter++;
        }
        filenames.add(fileName);
        // Add file to zip
        const zipFile = new ZipDeflate(fileName, deflateOptions);
        zip.add(zipFile);
        filesPushed.push(
          getPromise.then(({ data }) =>
            zipFile.push(new Uint8Array(data), true)
          )
        );
      }
      // Wait for all files to be pushed to end the zip
      Promise.all(filesPushed).then(zip.end.bind(zip));
      zipDone
        .then(blob => {
          const dataURL = URL.createObjectURL(blob);
          const params = {
            href: dataURL,
            download: "snapshot.zip"
          };
          downloadToClient(params);
        })
        .finally(() => (this.downloading = false));
    }
  }

  getChannelDownloadURLs() {
    const allChannels = this.store.dataset?.channels;
    const baseUrl = this.getBaseURL();
    if (!allChannels || !baseUrl) {
      return [];
    }
    let channelsToDownload = [];
    if (this.exportChannel === "all") {
      channelsToDownload = allChannels;
    } else {
      channelsToDownload = [this.exportChannel];
    }
    const urls: URL[] = [];
    for (const channel of channelsToDownload) {
      const url = this.getChannelDownloadURL(baseUrl, channel);
      if (url) {
        urls.push(url);
      }
    }
    return urls;
  }

  getChannelDownloadURL(baseUrl: URL, channel: number) {
    const image = this.store.getImagesFromChannel(channel)[0];
    if (!image) {
      return null;
    }
    const url = new URL(baseUrl);
    url.searchParams.set("frame", image.frameIndex.toString());
    return url;
  }

  async getLayerDownloadURLs() {
    const layers = this.store.layers;
    const baseUrl = this.getBaseURL();
    if (!layers || !baseUrl) {
      return [];
    }

    // Get layer bands: style and frame idx
    const bands: ITileOptionsBands["bands"] = [];
    const promises: Promise<any>[] = [];
    const pushBand = bands.push.bind(bands);
    if (this.exportLayer === "composite" || this.exportLayer === "all") {
      layers.forEach(layer => {
        if (layer.visible || this.exportLayer === "all") {
          promises.push(this.getBandOption(layer).then(pushBand));
        }
      });
    } else {
      const layerId = this.exportLayer;
      const layer = this.store.getLayerFromId(layerId);
      if (!layer) {
        return [];
      }
      promises.push(this.getBandOption(layer).then(pushBand));
    }
    await Promise.all(promises);

    // Return one URL per band or a single URL with all bands
    if (this.exportLayer === "all") {
      const urls = [];
      for (const band of bands) {
        const url = new URL(baseUrl);
        const style = JSON.stringify({ bands: [band] });
        url.searchParams.set("style", style);
        urls.push(url);
      }
      return urls;
    } else {
      const url = new URL(baseUrl);
      const style = JSON.stringify({ bands });
      url.searchParams.set("style", style);
      return [url];
    }
  }

  // Returns the style of the layer combined with the frame idx
  getBandOption(layer: IDisplayLayer) {
    const image = this.store.getImagesFromLayer(layer)[0];
    const histogramPromise = this.store.getLayerHistogram(layer);
    const bandPromise = histogramPromise.then(histogram => {
      const style = this.getLayerStyle(layer, histogram, image);
      return { ...style, frame: image.frameIndex };
    });
    return bandPromise;
  }

  getBaseURL() {
    const anyImage: IImage | undefined = this.store.getImagesFromChannel(0)[0];
    const params = this.getBasicDownloadParams();
    if (!anyImage || !params) {
      return null;
    }
    const itemId = anyImage.item._id;
    const apiRoot = this.store.api.client.apiRoot;
    const baseUrl = new URL(`${apiRoot}/item/${itemId}/tiles/region`);
    for (const [key, value] of Object.entries(params)) {
      baseUrl.searchParams.set(key, value);
    }
    return baseUrl;
  }

  getLayerStyle(
    layer: IDisplayLayer,
    histogram: ITileHistogram | null,
    image: IImage | null
  ) {
    return toStyle(
      layer.color,
      layer.contrast,
      histogram,
      layer,
      this.store.dataset,
      image
    );
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

  @Watch("firstMap")
  resetBboxLayer() {
    if (this.snapshotVisible) {
      this.showSnapshot(false);
      this.showSnapshot(true);
      this.markCurrentArea();
      this.drawBoundingBox();
    }
  }

  showSnapshot(show: boolean) {
    const map = this.firstMap;
    if (!map) {
      return;
    }
    if (this.bboxHeight <= 0 && this.bboxWidth <= 0) {
      const inset = 20; // in pixels
      const topLeft = map.displayToGcs({ x: inset, y: inset });
      const bottomRight = map.displayToGcs({
        x: map.size().width - inset,
        y: map.size().height - inset
      });
      this.bboxLeft = topLeft.x;
      this.bboxTop = topLeft.y;
      this.bboxRight = bottomRight.x;
      this.bboxBottom = bottomRight.y;
    }
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
        }) as IGeoJSLayer;
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
        }) as IGeoJSAnnotation;
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
    const dataset = store.dataset;
    if (!dataset) {
      return;
    }
    const w = dataset.width;
    const h = dataset.height;
    let coordinates = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h }
    ];
    coordinates = [
      { x: this.bboxLeft, y: this.bboxTop },
      { x: this.bboxRight, y: this.bboxTop },
      { x: this.bboxRight, y: this.bboxBottom },
      { x: this.bboxLeft, y: this.bboxBottom }
    ];
    const map = this.firstMap;
    if (this.bboxLayer && this.bboxAnnotation && map) {
      this.bboxLayer.visible(true);
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
    const map = this.firstMap;
    if (!map) {
      return;
    }
    if (mode === "full" && store.dataset) {
      this.setBoundingBox(0, 0, store.dataset.width, store.dataset.height);
    } else if (mode === "viewport" && map && store.dataset) {
      const bounds = map.bounds();
      this.setBoundingBox(bounds.left, bounds.top, bounds.right, bounds.bottom);
    }
    this.markCurrentArea();
  }

  drawBoundingBox() {
    if (this.bboxLayer && this.bboxAnnotation) {
      this.bboxLayer.mode(null);
      this.bboxLayer.mode(this.bboxLayer.modes.edit, this.bboxAnnotation);
      this.bboxLayer.draw();
    }
    const map = this.firstMap;
    if (!map) {
      return;
    }
    map.geoOff(geojs.event.annotation.mode, this.doneBoundingBox);
    map.geoOff(geojs.event.annotation.coordinates, this.boundingBoxCoordinates);
    map.geoOn(geojs.event.annotation.mode, this.doneBoundingBox);
    map.geoOn(geojs.event.annotation.coordinates, this.boundingBoxCoordinates);
    this.markCurrentArea();
  }

  boundingBoxCoordinates(event: { [key: string]: any }) {
    const coord = event.annotation!.coordinates();
    if (event.annotation === this.bboxAnnotation && coord.length === 4) {
      this.setBoundingBox(
        Math.min(coord[0].x, coord[2].x),
        Math.min(coord[0].y, coord[2].y),
        Math.max(coord[0].x, coord[2].x),
        Math.max(coord[0].y, coord[2].y)
      );
    }
  }

  doneBoundingBox(allDone: boolean) {
    const map = this.firstMap;
    if (!map) {
      return;
    }
    map.geoOff(geojs.event.annotation.mode, this.doneBoundingBox);
    map.geoOff(geojs.event.annotation.coordinates, this.boundingBoxCoordinates);
    const coord = this.bboxAnnotation?.coordinates();
    if (coord && coord.length === 4) {
      this.setBoundingBox(
        Math.min(coord[0].x, coord[2].x),
        Math.min(coord[0].y, coord[2].y),
        Math.max(coord[0].x, coord[2].x),
        Math.max(coord[0].y, coord[2].y)
      );
    }
    if (this.bboxLayer) {
      if (this.bboxLayer.map().interactor()) {
        this.bboxLayer.mode(null);
      }
      this.bboxLayer.draw();
    }
    if (allDone !== true) {
      this.drawBoundingBox();
    }
  }

  snapshotList(sortMode?: string) {
    const sre = new RegExp(this.snapshotSearch || "", "i");
    const results: ISnapshotItem[] = [];
    if (store.configuration && store.configuration.snapshots) {
      const snapshots = store.configuration.snapshots.slice();
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

  areCurrentLayersCompatible(snapshot: ISnapshot) {
    // Returns true if all layers of the snapshot also exist in the store and have the same channel
    const currentLayers = this.store.layers;
    return snapshot.layers.every(snapshotLayer => {
      const storeLayer = currentLayers.find(
        layer => layer.id === snapshotLayer.id
      );
      return !!storeLayer && storeLayer.channel === snapshotLayer.channel;
    });
  }

  openConfigurationLayersOverwritePanel(snapshot: ISnapshot) {
    this.layersOverwritePanel = true;
    this.overwrittingSnaphot = snapshot;
  }

  changeDatasetViewContrasts() {
    if (this.overwrittingSnaphot) {
      this.store.loadSnapshotLayers(this.overwrittingSnaphot);
      this.overwrittingSnaphot = null;
    }
    this.layersOverwritePanel = false;
  }

  overwriteConfigurationLayers() {
    const layers = this.overwrittingSnaphot?.layers;
    if (layers) {
      this.store.setConfigurationLayers(layers);
      this.overwrittingSnaphot = null;
      this.store.resetDatasetViewContrasts();
    }
    this.layersOverwritePanel = false;
  }

  async loadSnapshot(item: ISnapshotItem) {
    const snapshot = item.record;
    if (this.areCurrentLayersCompatible(snapshot)) {
      await this.store.loadSnapshotLayers(snapshot);
    } else {
      this.openConfigurationLayersOverwritePanel(snapshot);
    }
    this.newName = snapshot.name || "";
    this.newDescription = snapshot.description || "";
    this.newTags = (snapshot.tags || []).slice();
    this.format = snapshot.screenshot!.format;
    this.bboxLeft = snapshot.screenshot!.bbox!.left;
    this.bboxTop = snapshot.screenshot!.bbox!.top;
    this.bboxRight = snapshot.screenshot!.bbox!.right;
    this.bboxBottom = snapshot.screenshot!.bbox!.bottom;

    await this.$router
      .replace({
        query: {
          ...this.$route.query,
          unrollXY: snapshot.unrollXY.toString(),
          unrollZ: snapshot.unrollZ.toString(),
          unrollT: snapshot.unrollT.toString(),
          xy: snapshot.xy.toString(),
          z: snapshot.z.toString(),
          time: snapshot.time.toString(),
          layer: snapshot.layerMode
        }
      })
      .catch(() => {}); /* catch redundant navigation warnings */

    const map = this.firstMap;
    if (!map) {
      return;
    }
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

  updateFormValidation() {
    const formElem = this.$refs.saveSnapshotForm;
    if (formElem) {
      this.isSaveSnapshotValid = formElem.validate();
    }
  }

  resetFormValidation() {
    const formElem = this.$refs.saveSnapshotForm;
    if (formElem) {
      formElem.resetValidation();
    }
  }

  saveSnapshot(): void {
    this.updateFormValidation();
    const map = this.firstMap;
    if (!this.isSaveSnapshotValid || !map) {
      return;
    }
    const snapshot: ISnapshot = {
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
      layers: store.layers.map(copyLayerWithoutPrivateAttributes),
      screenshot: {
        format: this.format,
        bbox: {
          left: this.bboxLeft,
          top: this.bboxTop,
          right: this.bboxRight,
          bottom: this.bboxBottom
        }
      }
    };
    this.resetAndCloseForm();
    this.store.addSnapshot(snapshot);
  }

  resetAndCloseForm() {
    this.createDialog = false;
    this.newName = "";
    this.newDescription = "";
    this.newTags = [];
    this.resetFormValidation();
  }

  removeSnapshot(name: string): void {
    this.store.removeSnapshot(name);
  }

  get currentSnapshot(): { [key: string]: any } | undefined {
    if (store.configuration && store.configuration.snapshots) {
      return store.configuration.snapshots
        .slice()
        .filter(s => s.name === this.newName)[0];
    }
    return;
  }
}
</script>
