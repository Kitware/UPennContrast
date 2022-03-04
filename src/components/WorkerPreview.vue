<template>
  <v-container>
    <v-row>
      <v-img contain :src="workerPreview.image" v-if="workerPreview.image" />
    </v-row>
    <v-row>
      <v-subheader>{{ workerPreview.text }}</v-subheader>
    </v-row>
  </v-container>
</template>
<script lang="ts">
import { Vue, Component, Watch, Prop, VModel } from "vue-property-decorator";
import store from "@/store";
import annotationsStore from "@/store/annotation";
import propertiesStore from "@/store/properties";
import LayerSelect from "@/components/LayerSelect.vue";
import DockerImageSelect from "@/components/DockerImageSelect.vue";
import TagPicker from "@/components/TagPicker.vue";
// Popup for new tool configuration
@Component({ components: { LayerSelect, TagPicker, DockerImageSelect } })
export default class WorkerPreview extends Vue {
  readonly store = store;
  readonly annotationsStore = annotationsStore;
  readonly propertyStore = propertiesStore;

  @VModel({ type: Boolean }) show!: Boolean;

  @Prop()
  readonly workerPreview!: { image: string; text: string };
}
</script>
