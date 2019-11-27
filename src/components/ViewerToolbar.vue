<template>
  <div>
    <value-slider v-model="z" label="Z Value" :min="0" :max="maxZ" />
    <value-slider v-model="time" label="Time Value" :min="0" :max="maxTime" />
  </div>
</template>
<script lang="ts">
import { Vue, Component, Inject, Prop } from "vue-property-decorator";
import ValueSlider from "./ValueSlider.vue";
import store from "@/store";

@Component({
  components: {
    ValueSlider
  }
})
export default class ViewerToolbar extends Vue {
  readonly store = store;

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
