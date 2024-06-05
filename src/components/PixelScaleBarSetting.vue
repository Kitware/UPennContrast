<template>
  <v-switch
    hide-details
    dense
    v-model="showPixelScalebar"
    label="Show pixel scalebar"
    title="Show the scalebarwidget on top of the image for the number of pixels"
    v-description="{
      section: 'Scale settings',
      title: 'Show pixel scalebar',
      description:
        'Show the scalebar widget at the bottom right of the image for the number of pixels; click scalebar to edit settings',
    }"
  />
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store/index";

@Component
export default class PixelScaleBarSetting extends Vue {
  readonly store = store;

  get showPixelScalebar() {
    return this.store.showPixelScalebar;
  }

  set showPixelScalebar(value) {
    this.store.setShowPixelScalebar(value);
  }
}
</script>
