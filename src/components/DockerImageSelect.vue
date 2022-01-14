<template>
  <!-- image -->
  <v-select :items="images" dense v-model="image" label="Docker image" />
</template>

<script lang="ts">
import { Vue, Component, VModel } from "vue-property-decorator";
import store from "@/store";

// Interface element selecting an image
@Component({
  components: {},
})
export default class DockerImageSelect extends Vue {
  readonly store = store;

  images = [
    "boucaud/sample_intensity_worker:latest",
    "boucaud/spotfinding:latest"
  ]; // TODO: get from store/api

  @VModel({ type: String }) image!: String;
}
</script>
