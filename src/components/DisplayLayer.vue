<template>
  <v-expansion-panel>
    <v-expansion-panel-header class="displayLayerHeader">
      <v-row dense class="layerHeader">
        <v-col class="denseCol">
          <v-icon :color="value.color" left>mdi-circle</v-icon>
        </v-col>
        <v-col class="textCol">
          <div class="header pa-1">{{ value.name }}</div>
        </v-col>
        <v-col class="denseCol">
          <div v-if="index === 0" class="text-caption pb-2" title="hotkey Z">
            Z max-merge
          </div>
          <v-switch
            @click.native.stop
            @mousedown.native.stop
            @mouseup.native.stop
            v-mousetrap="{
              bind: zMaxMergeBinding(index),
              handler: () => (isZMaxMerge = !isZMaxMerge)
            }"
            class="toggleButton"
            v-model="isZMaxMerge"
            :title="`Toggle Z Max Merge (hotkey ${zMaxMergeBinding(index)})`"
            :displayed="displayZ"
            dense
            hide-details
          />
        </v-col>
        <v-col class="denseCol">
          <div v-if="index === 0" class="text-caption pb-2" title="hotkey 0">
            Channel on/off
          </div>
          <v-switch
            @click.native.stop
            @mousedown.native.stop
            @mouseup.native.stop
            v-mousetrap="{
              bind: `${index + 1}`,
              handler: () => store.toggleLayerVisibility(index)
            }"
            class="toggleButton"
            v-model="visible"
            :title="`Toggle Visibility (hotkey ${index + 1})`"
            dense
            hide-details
          />
        </v-col>
      </v-row>
    </v-expansion-panel-header>
    <v-expansion-panel-content :class="{ notVisible: !value.visible }">
      <v-text-field
        :value="value.name"
        @change="changeProp('name', $event)"
        label="Name"
        dense
        hide-details
      />
      <contrast-histogram
        :configurationContrast="configurationContrast"
        :viewContrast="currentContrast"
        @change="changeContrast($event, false)"
        @commit="changeContrast($event, true)"
        @revert="resetContrastInView()"
        :histogram="histogram"
      />
      <v-menu
        ref="colorMenu"
        v-model="showColorPicker"
        :close-on-content-click="false"
        :nudge-right="40"
        transition="scale-transition"
        offset-y
        max-width="300px"
        min-width="300px"
      >
        <template #activator="{ on }">
          <v-text-field
            :value="value.color"
            @change="changeProp('color', $event)"
            label="Color"
            readonly
            dense
            hide-details
            v-on="on"
          >
            <template #append>
              <v-icon :color="value.color">mdi-square</v-icon>
            </template>
          </v-text-field>
        </template>
        <v-color-picker
          v-if="showColorPicker"
          :value="value.color"
          hide-canvas
          @input="changeProp('color', $event)"
          width="300"
        />
      </v-menu>
      <v-radio-group
        row
        v-model="channel"
        label="Channel"
        dense
        hide-details
        class="channel"
      >
        <v-radio
          v-for="(channel, index) in channels"
          :key="index"
          :value="index"
          :label="channelName(channel)"
        />
      </v-radio-group>
      <display-slice
        :value="value.xy"
        @change="changeProp('xy', $event)"
        label="XY-Slice"
        :max-value="maxXY"
        v-if="maxXY > 0"
        :displayed="displayXY"
        :offset="1"
      />
      <display-slice
        :value="value.z"
        @change="changeProp('z', $event)"
        label="Z-Slice"
        :max-value="maxZ"
        v-if="maxZ > 0"
        :displayed="displayZ"
        :offset="1"
      />
      <display-slice
        :value="value.time"
        @change="changeProp('time', $event)"
        label="Time-Slice"
        :max-value="maxTime"
        v-if="maxTime > 0"
        :displayed="displayTime"
        :offset="1"
      />
      <div class="buttons">
        <v-btn color="warning" small @click="removeLayer">Remove</v-btn>
      </div>
    </v-expansion-panel-content>
  </v-expansion-panel>
</template>

<script lang="ts">
import { Vue, Component, Prop, Emit, Watch } from "vue-property-decorator";
import { IDisplayLayer, IContrast, IDisplaySlice } from "../store/model";
import DisplaySlice from "./DisplaySlice.vue";
import ContrastHistogram from "./ContrastHistogram.vue";
import store from "../store";

@Component({
  components: {
    DisplaySlice,
    ContrastHistogram
  }
})
export default class DisplayLayer extends Vue {
  readonly store = store;
  @Prop()
  readonly value!: IDisplayLayer;

  @Prop()
  readonly index!: number;

  showColorPicker = false;

  get histogram() {
    return this.store.getLayerHistogram(this.value);
  }

  get channels() {
    return this.store.dataset ? this.store.dataset.channels : [];
  }

  get configurationContrast() {
    const layerId = this.value.id;
    const configuration = this.store.configuration;
    if (!configuration) {
      return null;
    }
    const configurationLayer = configuration.layers.find(
      layer => layer.id === layerId
    );
    if (!configurationLayer) {
      return null;
    }
    return configurationLayer.contrast;
  }

  get currentContrast() {
    return this.value.contrast;
  }

  channelName(channel: number): string {
    let result = channel.toString();
    if (this.store.dataset) {
      result = this.store.dataset.channelNames.get(channel) || result;
    }
    return result;
  }

  get visible() {
    return this.value.visible;
  }

  alternativeZSlice: IDisplaySlice =
    this.value.z.type === "max-merge"
      ? { type: "current", value: null }
      : { ...this.value.z };

  zMaxMergeBinding(index: number) {
    return `shift+${index + 1}`;
  }

  get isZMaxMerge() {
    return this.zSlice.type === "max-merge";
  }

  set isZMaxMerge(value: boolean) {
    if (this.isZMaxMerge === value) {
      return;
    }
    const newZSlice = value
      ? {
          type: "max-merge",
          value: null
        }
      : this.alternativeZSlice;
    this.changeProp("z", newZSlice);
  }

  get zSlice() {
    return this.value.z;
  }

  @Watch("zSlice")
  zSliceChanged() {
    if (!this.isZMaxMerge) {
      this.alternativeZSlice = { ...this.zSlice };
    }
  }

  set visible(value: boolean) {
    if (this.visible === value) {
      return;
    }
    this.store.toggleLayerVisibility(this.index);
  }

  get channel() {
    return this.value.channel;
  }

  set channel(value: number) {
    this.changeProp("channel", value);
  }

  get maxXY() {
    return this.store.dataset
      ? this.store.dataset.xy.length - 1
      : this.value.xy.value || 0;
  }

  get maxZ() {
    return this.store.dataset
      ? this.store.dataset.z.length - 1
      : this.value.z.value || 0;
  }

  get maxTime() {
    return this.store.dataset
      ? this.store.dataset.time.length - 1
      : this.value.time.value || 0;
  }

  get displayXY() {
    return this.store.xy;
  }

  get displayZ() {
    return this.store.z;
  }

  get displayTime() {
    return this.store.time;
  }

  changeProp(prop: keyof IDisplayLayer, value: any) {
    if (this.value[prop] === value) {
      return;
    }
    this.store.changeLayer({
      index: this.index,
      delta: {
        [prop]: value
      }
    });
  }

  changeContrast(contrast: IContrast, syncConfiguration: boolean) {
    if (syncConfiguration) {
      this.store.saveContrastInConfiguration({
        index: this.index,
        contrast
      });
    } else {
      this.store.saveContrastInView({ layerIdx: this.index, contrast });
    }
  }

  resetContrastInView() {
    this.store.resetContrastInView(this.index);
  }

  removeLayer() {
    this.store.removeLayer(this.index);
  }
}
</script>
<style lang="scss" scoped>
.notVisible {
  opacity: 0.5;
}

.displayLayerHeader {
  > i {
    flex: 0 0 auto;
  }
  > .header {
    flex: 1 1 0;
  }
}

.toggleButton {
  margin: 0;
  flex: 0 0 auto;
}

.layerHeader {
  align-items: flex-end;
}

.denseCol {
  flex-grow: 0;
}

.textCol {
  overflow: hidden;
}

.buttons {
  display: flex;
  justify-content: flex-end;
}

.channel {
  ::v-deep .v-label {
    width: 100%;
  }

  ::v-deep .v-radio {
    margin-right: 10px;

    > .v-label {
      font-size: 14px;
    }
  }
}
</style>
