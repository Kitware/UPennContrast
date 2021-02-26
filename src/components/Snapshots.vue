<template>
  <div class="snapshots">
    <v-dialog v-model="dialog" width="500" v-if="store.configuration">
      <template v-slot:activator="{ on, attrs }">
        <v-btn v-bind="attrs" v-on="on">
          Snapshot
        </v-btn>
      </template>

      <v-card>
        <v-card-title class="headline">
          Snapshot
        </v-card-title>
        <v-card-text>
          <div class="group-label">Resolution and Area:</div>
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
              label="Full"
              value="full"
              v-if="!isUnrolled"
              title="The entire image"
            ></v-radio>
          </v-radio-group>
          <v-text-field
            label="Maximum resolution"
            :disabled="area == 'screen'"
            v-model="maxResolution"
            type="number"
            :max="
              Math.min(
                10000,
                Math.max(store.dataset.width, store.dataset.height)
              )
            "
            dense
          ></v-text-field>
          <v-select
            v-model="exportLayer"
            :items="layerList"
            label="Layer"
            item-text="name"
            item-value="key"
            dense
            single-line
          ></v-select>
          <v-select
            v-model="format"
            :items="formatList"
            label="Format"
            item-text="name"
            item-value="key"
            dense
            single-line
          ></v-select>
        </v-card-text>

        <v-divider></v-divider>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="primary"
            text
            @click="
              dialog = false;
              getDownload();
            "
          >
            Download
          </v-btn>
          <v-btn color="primary" text @click="dialog = false">
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

  area: string = "full";
  maxResolution: number | null = null;
  exportLayer: string = "all";
  format: string = "png";

  readonly formatList: object[] = [
    { name: "PNG", key: "png" },
    { name: "JPEG - Quality 95", key: "jpeg-95" },
    { name: "JPEG - Quality 90", key: "jpeg-90" },
    { name: "JPEG - Quality 80", key: "jpeg-80" }
  ];

  get isUnrolled(): boolean {
    return store.unrollZ || store.unrollXY || store.unrollT;
  }

  isRotated(): boolean {
    const map = Vue.prototype.$currentMap;
    return map && !!map.rotation();
  }

  get layerList(): object[] {
    let results = [];
    if (this.area !== "screen") {
      results.push({ name: "All", key: "all" });
    }
    if (store.configuration && store.configuration.layers) {
      store.configuration.layers.forEach((layer, idx) => {
        if (layer.visible) {
          results.push({ name: layer.name, key: "" + idx });
        }
      });
    }
    return results;
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
    let w = store.dataset!.width;
    let h = store.dataset!.height;
    let params: any = {
      encoding: this.format === "png" ? "PNG" : "JPEG",
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
    }
    let max = Math.min(
      Math.min(this.maxResolution || 1e8, 10000),
      Math.max(w, h)
    );
    params.width = max;
    params.height = max;
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
