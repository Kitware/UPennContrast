<template>
  <div>
    <div>
      <toolset></toolset>
      <v-layout>
        <value-slider
          v-model="xy"
          label="XY"
          :min="0"
          :max="maxXY"
          :title="maxXY > 0 ? maxXY + 1 + ' XY Values' : ''"
          :offset="1"
        />
        <v-checkbox
          class="ml-3"
          v-model="unrollXY"
          label="Unroll"
          :disabled="!(maxXY > 0 || unrollXY)"
        />
      </v-layout>
      <v-layout>
        <value-slider
          v-model="z"
          label="Z"
          :min="0"
          :max="maxZ"
          :title="maxZ > 0 ? maxZ + 1 + ' Z Values' : ''"
          :offset="1"
        />
        <v-checkbox
          class="ml-3"
          v-model="unrollZ"
          label="Unroll"
          :disabled="!(maxZ > 0 || unrollZ)"
        />
      </v-layout>
      <v-layout>
        <value-slider
          v-model="time"
          label="Time"
          :min="0"
          :max="maxTime"
          :title="maxTime > 0 ? maxTime + 1 + ' Time Values' : ''"
          :offset="1"
        />
        <v-checkbox
          class="ml-3"
          v-model="unrollT"
          label="Unroll"
          :disabled="!(maxTime > 0 || unrollT)"
        />
      </v-layout>
      <switch-toggle
        v-model="layerMode"
        label="Layers: "
        true-label="Multiple"
        true-value="multiple"
        layout
        layoute-value="single"
        id="layerMode"
      />
    </div>
    <div class="lowertools">
      <slot></slot>
    </div>
  </div>
</template>
<style scoped>
.v-input--selection-controls {
  margin-top: 0;
}
.lowertools {
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
}
</style>
<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import ValueSlider from "./ValueSlider.vue";
import SwitchToggle from "./SwitchToggle.vue";
import Toolset from "@/tools/toolsets/Toolset.vue";
import store from "@/store";

@Component({
  components: {
    ValueSlider,
    SwitchToggle,
    Toolset
  }
})
export default class ViewerToolbar extends Vue {
  readonly store = store;

  private changeQuery(param: string, value: string) {
    const old = this.$route.query[param];
    if (old === value) {
      return;
    }
    this.$router.replace({
      query: {
        ...this.$route.query,
        [param]: value
      }
    });
  }

  get xy() {
    return this.store.xy;
  }

  get z() {
    return this.store.z;
  }

  get time() {
    return this.store.time;
  }

  set xy(value: number) {
    this.changeQuery("xy", value.toString());
  }

  set z(value: number) {
    this.changeQuery("z", value.toString());
  }

  set time(value: number) {
    this.changeQuery("time", value.toString());
  }

  get unrollXY() {
    return this.store.unrollXY;
  }

  set unrollXY(value: boolean) {
    this.changeQuery("unrollXY", value.toString());
  }

  @Watch("unrollXY")
  watchUnrollXY(_value: boolean) {
    this.store.refreshDataset();
  }

  get unrollZ() {
    return this.store.unrollZ;
  }

  set unrollZ(value: boolean) {
    this.store.setUnrollZ(value);
    this.changeQuery("unrollZ", value.toString());
  }

  @Watch("unrollZ")
  watchUnrollZ(_value: boolean) {
    this.store.refreshDataset();
  }

  get unrollT() {
    return this.store.unrollT;
  }

  set unrollT(value: boolean) {
    this.changeQuery("unrollT", value.toString());
  }

  @Watch("unrollT")
  watchUnrollT(_value: boolean) {
    this.store.refreshDataset();
  }

  get maxXY() {
    return this.store.dataset ? this.store.dataset.xy.length - 1 : this.xy;
  }

  get maxZ() {
    return this.store.dataset ? this.store.dataset.z.length - 1 : this.z;
  }

  get maxTime() {
    return this.store.dataset ? this.store.dataset.time.length - 1 : this.time;
  }

  set layerMode(value: "multiple" | "single") {
    this.changeQuery("layer", value);
  }

  get layerMode() {
    return this.store.layerMode;
  }
}
</script>
