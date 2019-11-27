<template>
  <div>
    <value-slider v-model="z" label="Z Value" :min="0" :max="maxZ" />
    <value-slider v-model="time" label="Time Value" :min="0" :max="maxTime" />
    <v-select v-model="mode" label="Composition Mode" :items="modes">
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
</template>
<script lang="ts">
import { Vue, Component, Inject, Prop } from "vue-property-decorator";
import ValueSlider from "./ValueSlider.vue";
import store from "@/store";
import { COMPOSITION_MODES } from "@/store/model";

@Component({
  components: {
    ValueSlider
  }
})
export default class ViewerToolbar extends Vue {
  readonly store = store;

  readonly modes = Object.keys(COMPOSITION_MODES);

  get mode() {
    return this.store.compositionMode;
  }

  set mode(value: string) {
    this.$router.replace({
      query: {
        ...this.$route.query,
        mode: value
      }
    });
  }

  get z() {
    return this.store.z;
  }

  get time() {
    return this.store.time;
  }

  set z(value: number) {
    this.$router.replace({
      query: {
        ...this.$route.query,
        z: value.toString()
      }
    });
  }

  set time(value: number) {
    this.$router.replace({
      query: {
        ...this.$route.query,
        time: value.toString()
      }
    });
  }

  get maxZ() {
    return this.store.dataset ? this.store.dataset.z.length : this.z;
  }

  get maxTime() {
    return this.store.dataset ? this.store.dataset.time.length : this.time;
  }
}
</script>
