<template>
  <v-expansion-panel>
    <v-expansion-panel-header> Viewer settings </v-expansion-panel-header>
    <v-expansion-panel-content>
      <v-container>
        <v-switch
          hide-details
          dense
          v-model="valueOnHover"
          label="Show channel values on hover"
          title="Show pixel intensity values when hovering cursor over image"
          v-description="{
            section: 'Viewer settings',
            title: 'Show channel values on hover',
            description:
              'Show pixel values for each layer when hovering over the image',
          }"
        />
        <v-switch
          hide-details
          dense
          v-model="overview"
          label="Show minimap"
          v-description="{
            section: 'Viewer settings',
            title: 'Show minimap',
            description: 'Show the overview panel',
          }"
        />
        <v-switch
          hide-details
          dense
          v-model="showScalebar"
          label="Show scalebar"
          title="Show the scalebarwidget on top of the image"
          v-description="{
            section: 'Viewer settings',
            title: 'Show scalebar',
            description:
              'Show the scalebar widget at the bottom right of the image; click scalebar to edit settings',
          }"
        />
        <pixel-scale-bar-setting />
        <v-switch
          hide-details
          dense
          v-model="scaleAnnotationsWithZoom"
          label="Scale points with zoom"
          title="Make point annotations scale with zoom level or stay a fixed size"
          v-description="{
            section: 'Viewer settings',
            title: 'Scale points with zoom',
            description:
              'Set size of the point annotations and allow to scale with zoom level or stay a fixed size',
          }"
        />
        <v-slider
          v-model="annotationsRadius"
          :thumb-label="true"
          min="1"
          max="100"
          label="Point annotations radius"
        />
        <v-select
          hide-details
          label="Compositing mode"
          v-model="compositionMode"
          :items="compositionItems"
        >
          <template #item="{ item }">
            <div style="width: 100%">
              <strong>
                {{ item.text }}
              </strong>
              <div class="body-2 text--secondary">
                {{ item.help }}
              </div>
              <v-divider />
            </div>
          </template>
        </v-select>
        <v-select
          label="Background color"
          v-model="backgroundColor"
          :items="backgroundItems"
        />
      </v-container>
    </v-expansion-panel-content>
  </v-expansion-panel>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store/index";
import {
  TCompositionMode,
  compositionItems,
  advancedCompositionItems,
} from "@/utils/compositionModes";
import PixelScaleBarSetting from "@/components/PixelScaleBarSetting.vue";

@Component({ components: { PixelScaleBarSetting } })
export default class ViewerSettings extends Vue {
  readonly store = store;
  readonly compositionItems = [
    { header: "Base Composition Modes" },
    ...compositionItems,
    { header: "Advanced Composition Modes" },
    ...advancedCompositionItems,
  ];
  readonly backgroundItems = [
    { value: "white", text: "White" },
    { value: "black", text: "Black" },
  ];

  get valueOnHover() {
    return this.store.valueOnHover;
  }

  set valueOnHover(value) {
    this.store.setValueOnHover(value);
  }

  get overview() {
    return this.store.overview;
  }

  set overview(value) {
    this.store.setOverview(value);
  }

  get showScalebar() {
    return this.store.showScalebar;
  }

  set showScalebar(value) {
    this.store.setShowScalebar(value);
  }

  get scaleAnnotationsWithZoom() {
    return this.store.scaleAnnotationsWithZoom;
  }

  set scaleAnnotationsWithZoom(value: boolean) {
    this.store.setScaleAnnotationsWithZoom(value);
  }

  get annotationsRadius() {
    return this.store.annotationsRadius;
  }

  set annotationsRadius(value: number) {
    const zoom = typeof value === "string" ? parseFloat(value) : value;
    this.store.setAnnotationsRadius(zoom);
  }

  get compositionMode() {
    return this.store.compositionMode;
  }

  set compositionMode(value: TCompositionMode) {
    this.store.setCompositionMode(value);
  }

  get backgroundColor() {
    return this.store.backgroundColor;
  }

  set backgroundColor(value: string) {
    this.store.setBackgroundColor(value);
  }
}
</script>

<style lang="scss">
.v-select-list .v-subheader {
  justify-content: center;
  font-weight: bold;
  border-top: solid 2px;
}
</style>
