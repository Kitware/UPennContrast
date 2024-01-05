<template>
  <v-container class="pa-0 ma-0">
    <v-row class="pa-0 ma-0">
      <v-col class="pa-0 ma-0">
        <v-subheader>Image: {{ image }}</v-subheader>
      </v-col>
    </v-row>
    <v-row class="pa-0 ma-0">
      <v-col cols="12">
        <worker-interface-values
          v-if="workerInterface"
          :workerInterface="workerInterface"
          v-model="interfaceValues"
        />
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Prop, VModel } from "vue-property-decorator";
import store from "@/store";
import annotationsStore from "@/store/annotation";
import { IWorkerInterfaceValues } from "@/store/model";
import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import LayerSelect from "@/components/LayerSelect.vue";
import propertiesStore from "@/store/properties";
import WorkerInterfaceValues from "@/components/WorkerInterfaceValues.vue";
// Popup for new tool configuration
@Component({
  components: {
    LayerSelect,
    TagFilterEditor,
    WorkerInterfaceValues,
  },
})
export default class PropertyWorkerMenu extends Vue {
  readonly store = store;
  readonly annotationsStore = annotationsStore;
  readonly propertyStore = propertiesStore;

  @VModel({ type: Object }) interfaceValues!: IWorkerInterfaceValues;

  show: boolean = true;
  running: boolean = false;
  previousRunStatus: boolean | null = null;

  @Prop()
  readonly image!: string | null;

  get workerInterface() {
    return this.image !== null
      ? this.propertyStore.getWorkerInterface(this.image)
      : undefined;
  }
}
</script>
