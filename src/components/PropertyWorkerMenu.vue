<template>
  <v-container class="pa-0 ma-0">
    <v-row class="pa-0 ma-0">
      <v-col class="pa-0 ma-0">
        <v-subheader>Image: {{ image }}</v-subheader>
      </v-col>
    </v-row>
    <v-row class="pa-0 ma-0">
      <v-col cols="12">
        <worker-interface
          :workerInterface="workerInterface"
          @compute="compute"
          :canPreview="false"
          :running="running"
          :status="previousRunStatus"
        >
        </worker-interface>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop, VModel } from "vue-property-decorator";
import store from "@/store";
import annotationsStore from "@/store/annotation";
import { IAnnotationProperty, IToolConfiguration } from "@/store/model";
import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import LayerSelect from "@/components/LayerSelect.vue";
import DockerImageSelect from "@/components/DockerImageSelect.vue";
import propertiesStore from "@/store/properties";
import WorkerInterface from "@/components/WorkerInterface.vue";
// Popup for new tool configuration
@Component({
  components: {
    LayerSelect,
    TagFilterEditor,
    DockerImageSelect,
    WorkerInterface
  }
})
export default class annotationWorkerMenu extends Vue {
  readonly store = store;
  readonly annotationsStore = annotationsStore;
  readonly propertyStore = propertiesStore;

  show: boolean = true;

  running: boolean = false;
  previousRunStatus: boolean | null = null;

  @Prop()
  readonly property!: IAnnotationProperty;

  get workerInterface() {
    return this.propertyStore.getWorkerInterface(this.image) || {};
  }

  get image() {
    return this.property?.image;
  }

  get workerPreview() {
    return (
      this.propertyStore.getWorkerPreview(this.image) || {
        text: "null",
        image: ""
      }
    );
  }

  compute(interfaceValues: any) {
    if (this.running) {
      return;
    }
    this.running = true;
    this.previousRunStatus = null;

    this.propertyStore.enableProperty({
      property: this.property,
      workerInterface: interfaceValues,
      callback: success => {
        this.running = false;
        this.previousRunStatus = success;
      }
    });
  }

  mounted() {
    this.updateInterface();
  }

  @Watch("image")
  updateInterface() {
    if (Object.keys(this.workerInterface).length === 0) {
      this.propertyStore.fetchWorkerInterface(this.image);
    }
  }
}
</script>
