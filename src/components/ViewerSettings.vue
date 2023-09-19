<template>
  <v-expansion-panel>
    <v-expansion-panel-header>
      Viewer settings
    </v-expansion-panel-header>
    <v-expansion-panel-content>
      <v-container>
        <v-switch
          hide-details
          dense
          v-model="valueOnHover"
          label="Show channel values on hover"
          title="Show pixel intensity values when hovering cursor over image"
          v-description="{
            section: 'Settings',
            title: 'Show values on hover',
            description:
              'Hide or show values for each layer when hovering the image'
          }"
        />
        <v-switch
          hide-details
          dense
          v-model="overview"
          label="Show minimap"
          v-description="{
            section: 'Settings',
            title: 'Show minimap',
            description: 'Hide or show the overview panel'
          }"
        />
        <v-switch
          hide-details
          dense
          v-model="showScalebar"
          label="Show scalebar"
          title="Show the scalebarwidget on top of the image"
          v-description="{
            section: 'Settings',
            title: 'Show scalebar',
            description:
              'Hide or show the scalebar widget at the bottom right of the image'
          }"
        />
        <v-switch
          hide-details
          dense
          v-model="scaleAnnotationsWithZoom"
          label="Scale points with zoom"
          title="Make point annotations radius fixed in sceen size"
          v-description="{
            section: 'Settings',
            title: 'Point annotations size',
            description:
              'Set size of the point annotations and their behavior when zooming'
          }"
        />
        <v-slider
          v-model="annotationsRadius"
          :thumb-label="true"
          min="1"
          max="100"
          label="Point annotations radius"
        />
      </v-container>
    </v-expansion-panel-content>
  </v-expansion-panel>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store/index";

@Component
export default class ViewerSettings extends Vue {
  readonly store = store;

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
}
</script>
