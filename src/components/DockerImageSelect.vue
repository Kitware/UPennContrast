<template>
  <!-- image -->
  <v-select :items="items" dense v-model="image" label="Algorithm" />
</template>

<script lang="ts">
import { Vue, Component, VModel, Prop } from "vue-property-decorator";
import store from "@/store";
import propertiesStore from "@/store/properties";
import { IWorkerLabels } from "@/store/model";

// Interface element selecting an image
@Component({
  components: {},
})
export default class DockerImageSelect extends Vue {
  readonly store = store;
  readonly propertyStore = propertiesStore;

  @VModel({ type: String }) image!: String;

  @Prop()
  readonly imageFilter!: { (labels: IWorkerLabels): boolean };

  get images() {
    return this.propertyStore.workerImageList;
  }

  get items() {
    const imagesPerCategory: { [category: string]: string[] } = {};
    for (const image in this.images) {
      const labels = this.images[image];
      if (this.imageFilter(labels)) {
        const category = labels.interfaceCategory || "No category";
        if (!imagesPerCategory[category]) {
          imagesPerCategory[category] = [];
        }
        imagesPerCategory[category].push(image);
      }
    }
    const items = [];
    for (const category in imagesPerCategory) {
      items.push({ divider: true }, { header: category });
      for (const image of imagesPerCategory[category]) {
        items.push({
          text: this.images[image].interfaceName || image,
          value: image,
        });
      }
    }
    return items;
  }

  mounted() {
    this.propertyStore.fetchWorkerImageList();
  }
}
</script>
