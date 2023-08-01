<template>
  <div class="contrast-panel">
    <v-expansion-panels class="panel-flex">
      <v-expansion-panel v-for="(layer, index) in layers" :key="index">
        <display-layer :value="layer" />
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script lang="ts">
import DisplayLayer from "./DisplayLayer.vue"; // Assuming DisplayLayer.vue is in the same directory
import store from "@/store";

export default {
  name: "ContrastPanels",
  components: {
    DisplayLayer
  },
  computed: {
    layers() {
      return store.layers;
    }
  }
};
</script>

<style scoped>
.contrast-panel {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  overflow-x: auto;
  white-space: nowrap;
}

.v-expansion-panel {
  width: 300px;
  margin-right: 3px; /* Add some space between panels */
  margin-left: 0; /* Ensure no left margin */
  padding: 0; /* Ensure no padding */
}

.panel-flex {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  flex: 0 1 auto;
}
</style>

<style lang="scss">
.v-expansion-panel {
  flex: 0 1 auto !important; /* There is a default style applied here by Vuetify that expands the children to take up all the space. Overriding that here gives the desired behavior. */
}
</style>
