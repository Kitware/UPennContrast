<template>
  <div>
    <div>
      <value-slider v-model="xy" label="XY Value" :min="0" :max="maxXY" />
      <v-checkbox
        v-model="splayXY"
        label="Unroll by XY"
        :disabled="!(maxXY > 0 || splayXY)"
      />
      <value-slider v-model="z" label="Z Value" :min="0" :max="maxZ" />
      <v-checkbox
        v-model="splayZ"
        label="Unroll by Z"
        :disabled="!(maxZ > 0 || splayZ)"
      />
      <value-slider v-model="time" label="Time Value" :min="0" :max="maxTime" />
      <v-checkbox
        v-model="splayT"
        label="Unroll by T"
        :disabled="!(maxTime > 0 || splayT)"
      />
      <switch-toggle
        v-model="layerMode"
        label="Layers: "
        true-label="Multiple"
        true-value="multiple"
        false-label="Single"
        false-value="single"
        id="layerMode"
      />
    </div>
    <div class="lowertools">
      <slot></slot>
      <v-select
        v-model="mode"
        label="Composition Mode"
        :items="modes"
        hide-details
      >
        <template #append>
          <v-btn
            href="https://mdn.mozillademos.org/en-US/docs/Web/API/Canvas_API/Tutorial/Compositing/Example$samples/Compositing_example"
            rel="noopener noreferrer"
            target="_blank"
            icon
          >
            <v-icon>mdi-open-in-new</v-icon>
          </v-btn>
        </template>
      </v-select>
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
import store from "@/store";
import { COMPOSITION_MODES } from "@/store/model";

@Component({
  components: {
    ValueSlider,
    SwitchToggle
  }
})
export default class ViewerToolbar extends Vue {
  readonly store = store;

  readonly modes = COMPOSITION_MODES.map(v => ({
    text: v[0],
    help: v[1],
    value: v[0]
  }));

  get mode() {
    return this.store.compositionMode;
  }

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

  set mode(value: string) {
    this.changeQuery("mode", value);
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

  get splayXY() {
    return this.store.splayXY;
  }

  set splayXY(value: boolean) {
    this.changeQuery("unrollXY", value.toString());
  }

  @Watch("splayXY")
  watchSplayXY(_value: boolean) {
    this.store.refreshDataset();
  }

  get splayZ() {
    return this.store.splayZ;
  }

  set splayZ(value: boolean) {
    this.store.setSplayZ(value);
    this.changeQuery("unrollZ", value.toString());
  }

  @Watch("splayZ")
  watchSplayZ(_value: boolean) {
    this.store.refreshDataset();
  }

  get splayT() {
    return this.store.splayT;
  }

  set splayT(value: boolean) {
    this.changeQuery("unrollT", value.toString());
  }

  @Watch("splayT")
  watchSplayT(_value: boolean) {
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
