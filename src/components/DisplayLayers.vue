<template>
  <div class="layers">
    <display-layer
      v-for="(l, index) in layers"
      :key="index"
      :value="l"
      :index="index"
    />
    <v-btn class="add-layer" @click="addLayer" icon>
      <v-icon>mdi-plus-circle</v-icon>
    </v-btn>
  </div>
</template>
<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import DisplayLayer from "./DisplayLayer.vue";
import store from "@/store";

@Component({
  components: {
    DisplayLayer
  }
})
export default class DisplayLayers extends Vue {
  readonly store = store;

  get layers() {
    return this.store.configuration ? this.store.configuration.layers : [];
  }

  addLayer() {
    this.store.addLayer();
  }
}
</script>

<style lang="scss" scoped>
.layers {
  display: flex;
  flex-direction: column;
}
.add-layer {
  align-self: center;
}
</style>
