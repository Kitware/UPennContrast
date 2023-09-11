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
        />
        <v-switch hide-details dense v-model="overview" label="Show minimap" />
        <v-switch
          hide-details
          dense
          v-model="showScalebar"
          label="Show scalebar"
          title="Show the scalebarwidget on top of the image"
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
}
</script>
