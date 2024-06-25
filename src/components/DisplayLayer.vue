<template>
  <v-expansion-panel>
    <v-expansion-panel-header class="displayLayerHeader">
      <v-row dense class="align-center">
        <v-col class="denseCol">
          <v-icon :color="value.color" left>mdi-circle</v-icon>
        </v-col>
        <v-col class="textCol">
          <div class="header pa-1">{{ value.name }}</div>
        </v-col>
        <v-col v-if="hoverValue !== null" class="denseCol">
          {{ hoverValue }}
        </v-col>
        <v-col class="denseCol">
          <v-switch
            @click.native.stop
            @mousedown.native.stop
            @mouseup.native.stop
            v-mousetrap="zMaxMergeHotkey"
            class="toggleButton"
            v-model="isZMaxMerge"
            v-show="hasMultipleZ"
            :title="`Toggle Z Max Merge (hotkey ${zMaxMergeBinding})`"
            dense
            hide-details
          />
        </v-col>
        <v-col class="denseCol">
          <v-switch
            @click.native.stop
            @mousedown.native.stop
            @mouseup.native.stop
            v-mousetrap="visibilityHotkey"
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
      <color-picker-menu
        :value="value.color"
        @input="changeProp('color', $event)"
        class="mb-4"
      />
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
      <v-expansion-panel>
        <v-expansion-panel-header
          >Advanced layer options</v-expansion-panel-header
        >
        <v-expansion-panel-content>
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
            <v-btn color="warning" small @click="removeLayer"
              >Delete layer</v-btn
            >
          </div>
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panel-content>
  </v-expansion-panel>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import { IDisplayLayer, IContrast, IDisplaySlice } from "../store/model";
import DisplaySlice from "./DisplaySlice.vue";
import ContrastHistogram from "./ContrastHistogram.vue";
import ColorPickerMenu from "./ColorPickerMenu.vue";
import store from "../store";
import { IHotkey } from "@/utils/v-mousetrap";

@Component({
  components: {
    DisplaySlice,
    ContrastHistogram,
    ColorPickerMenu,
  },
})
export default class DisplayLayer extends Vue {
  readonly store = store;

  @Prop({ required: true })
  readonly value!: IDisplayLayer;

  alternativeZSlice: IDisplaySlice = { type: "current", value: null };

  mounted() {
    this.alternativeZSlice =
      this.value.z.type === "max-merge"
        ? { type: "current", value: null }
        : { ...this.value.z };
  }

  get index() {
    return this.store.getLayerIndexFromId(this.value.id)!;
  }

  get hoverValue() {
    const layerId = this.value.id;
    return this.store.hoverValue?.[layerId]?.join(", ") ?? null;
  }

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
    const configurationLayer = this.store.getConfigurationLayerFromId(layerId);
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

  get zMaxMergeBinding() {
    return `shift+${this.index + 1}`;
  }

  get zMaxMergeHotkey(): IHotkey {
    return {
      bind: this.zMaxMergeBinding,
      handler: () => (this.isZMaxMerge = !this.isZMaxMerge),
      data: {
        section: "Layer control",
        description: `Toggle Z max-merge for layer: ${this.value.name}`,
      },
    };
  }

  get visibilityHotkey(): IHotkey {
    return {
      bind: `${this.index + 1}`,
      handler: () => store.toggleLayerVisibility(this.value.id),
      data: {
        section: "Layer control",
        description: `Show/hide layer: ${this.value.name}`,
      },
    };
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
          value: null,
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
    this.store.toggleLayerVisibility(this.value.id);
  }

  get channel() {
    return this.value.channel;
  }

  set channel(value: number) {
    // value can be undefined when going to another route:
    // routeMapper sets datasetId = null -> channels becomes [] -> channel = undefined
    if (value !== undefined) {
      this.changeProp("channel", value);
    }
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

  get hasMultipleZ() {
    return this.store.dataset && this.store.dataset.z.length > 1;
  }

  get displayTime() {
    return this.store.time;
  }

  changeProp(prop: keyof IDisplayLayer, value: any) {
    if (this.value[prop] === value) {
      return;
    }
    this.store.changeLayer({
      layerId: this.value.id,
      delta: {
        [prop]: value,
      },
    });
  }

  changeContrast(contrast: IContrast, syncConfiguration: boolean) {
    if (syncConfiguration) {
      this.store.saveContrastInConfiguration({
        layerId: this.value.id,
        contrast,
      });
    } else {
      this.store.saveContrastInView({ layerId: this.value.id, contrast });
    }
  }

  resetContrastInView() {
    this.store.resetContrastInView(this.value.id);
  }

  removeLayer() {
    this.store.removeLayer(this.value.id);
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
