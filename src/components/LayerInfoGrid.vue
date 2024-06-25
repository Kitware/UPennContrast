<template>
  <div class="layer-info-grid d-flex flex-column">
    <v-toolbar dense class="flex-grow-0">
      <v-toolbar-title>Contrast layers</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-btn icon @click="$emit('close')">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-toolbar>
    <v-container fluid class="flex-grow-1 overflow-auto pa-2">
      <v-row v-if="layers.length > 0" no-gutters class="flex-nowrap">
        <v-col v-for="layer in layers" :key="layer.id" cols="auto" class="mr-2">
          <v-card outlined width="300">
            <v-card-title class="text-subtitle-2">
              <v-icon :color="layer.color" small left>mdi-circle</v-icon>
              {{ layer.name }}
              <v-spacer></v-spacer>
              <v-switch
                v-model="layer.visible"
                @change="toggleVisibility(layer.id)"
                dense
                hide-details
                class="mt-0"
              />
            </v-card-title>
            <v-card-text>
              <contrast-histogram
                :configurationContrast="getConfigurationContrast(layer.id)"
                :viewContrast="layer.contrast"
                @change="changeContrast(layer.id, $event, false)"
                @commit="changeContrast(layer.id, $event, true)"
                @revert="resetContrastInView(layer.id)"
                :histogram="getLayerHistogram(layer)"
              />
              <color-picker-menu
                :value="layer.color"
                @input="changeLayerColor(layer.id, $event)"
              />
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
      <v-row v-else>
        <v-col>
          <v-alert type="info">No layers available.</v-alert>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import { IDisplayLayer, IContrast } from "../store/model";
import store from "../store";
import ContrastHistogram from "./ContrastHistogram.vue";
import ColorPickerMenu from "./ColorPickerMenu.vue";

@Component({
  components: {
    ContrastHistogram,
    ColorPickerMenu,
  },
})
export default class LayerInfoGrid extends Vue {
  @Prop({ required: true }) readonly layers!: IDisplayLayer[];

  toggleVisibility(layerId: string) {
    store.toggleLayerVisibility(layerId);
  }

  getConfigurationContrast(layerId: string) {
    const configuration = store.configuration;
    if (!configuration) {
      return null;
    }
    const configurationLayer = store.getConfigurationLayerFromId(layerId);
    if (!configurationLayer) {
      return null;
    }
    return configurationLayer.contrast;
  }

  getLayerHistogram(layer: IDisplayLayer) {
    return store.getLayerHistogram(layer);
  }

  changeContrast(
    layerId: string,
    contrast: IContrast,
    syncConfiguration: boolean,
  ) {
    if (syncConfiguration) {
      store.saveContrastInConfiguration({ layerId, contrast });
    } else {
      store.saveContrastInView({ layerId, contrast });
    }
  }

  resetContrastInView(layerId: string) {
    store.resetContrastInView(layerId);
  }

  changeLayerColor(layerId: string, color: string) {
    store.changeLayer({
      layerId,
      delta: { color },
    });
  }
}
</script>

<style lang="scss" scoped>
.layer-info-grid {
  background-color: rgb(0, 0, 0);
  max-width: 100vw;
  height: 100%; // Ensure it takes full height of parent
}
</style>
