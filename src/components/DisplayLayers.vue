<template>
  <v-expansion-panels multiple accordion>
    <display-layer
      v-for="(l, index) in layers"
      :key="l.id"
      :value="l"
      :index="index"
    />
    <v-expansion-panel readonly class="add-layer">
      <v-btn @click="addLayer" icon>
        <v-icon>mdi-plus-circle</v-icon>
      </v-btn>
    </v-expansion-panel>
  </v-expansion-panels>
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
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
