<template>
  <!-- image -->
  <v-select :items="images" dense v-model="image" label="Docker image" />
</template>

<script lang="ts">
import { Vue, Component, VModel } from "vue-property-decorator";
import store from "@/store";
import propertiesStore from "@/store/properties";

// Interface element selecting an image
@Component({
  components: {}
})
export default class DockerImageSelect extends Vue {
  readonly store = store;
  readonly propertyStore = propertiesStore;

  @VModel({ type: String }) image!: String;

  get images() {
    return this.propertyStore.workerImageList;
  }

  mounted() {
    if (!this.images.length) {
      this.propertyStore.fetchWorkerImageList();
    }
  }
}
</script>
