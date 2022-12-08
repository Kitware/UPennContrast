<template>
  <!-- image -->
  <v-select :items="previewItems" dense v-model="image" label="Docker image" />
</template>

<script lang="ts">
import { Vue, Component, VModel, Watch } from "vue-property-decorator";
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

  get previewItems() {
    const previewItems = [];
    for (const image in this.propertyStore.workerPreviews) {
      const preview = this.propertyStore.workerPreviews[image];
      const text =
        typeof preview.text === "string" && preview.text.length
          ? preview.text
          : image;
      previewItems.push({ text, value: image });
    }
    return previewItems;
  }

  mounted() {
    if (!this.images.length) {
      this.propertyStore.fetchWorkerImageList();
    }
  }

  @Watch("images")
  imagesChanged() {
    for (const image of this.images) {
      if (!this.propertyStore.workerPreviews[image]) {
        this.propertyStore.fetchWorkerPreview(image);
      }
    }
  }
}
</script>
