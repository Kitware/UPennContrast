<template>
  <v-expansion-panels>
    <v-expansion-panel v-model="show" v-if="tool">
      <v-expansion-panel-header>
        {{ tool.name }} worker menu
      </v-expansion-panel-header>
      <v-expansion-panel-content class="pa-0 ma-0">
        <v-container class="pa-0 ma-0">
          <v-row class="pa-0 ma-0">
            <v-col class="pa-0 ma-0">
              <v-subheader>Image: {{ tool.values.image.image }}</v-subheader>
            </v-col>
          </v-row>
          <v-row class="pa-0 ma-0">
            <v-col cols="12">
              <worker-interface
                :workerInterface="workerInterface"
                @preview="preview"
                @compute="compute"
                :canPreview="true"
                :running="running"
                :status="previousRunStatus"
              >
              </worker-interface>
            </v-col>
          </v-row>
        </v-container>
      </v-expansion-panel-content>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop, VModel } from "vue-property-decorator";
import store from "@/store";
import annotationsStore from "@/store/annotation";
import { IToolConfiguration } from "@/store/model";
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
    WorkerInterface,
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
  readonly tool!: IToolConfiguration;

  get workerInterface() {
    return this.propertyStore.getWorkerInterface(this.image) || {};
  }

  get image() {
    return this.tool?.values?.image?.image;
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
    this.annotationsStore.computeAnnotationsWithWorker({
      tool: this.tool,
      workerInterface: interfaceValues,
      callback: success => {
        this.running = false;
        this.previousRunStatus = success;
      }
    });
    this.show = false;
  }

  preview(result: any) {
    this.propertyStore.requestWorkerPreview({
      image: this.image,
      tool: this.tool,
      workerInterface: result
    });
  }

  mounted() {
    this.updateInterface();
  }

  @Watch("tool")
  updateInterface() {
    if (Object.keys(this.workerInterface).length === 0) {
      this.propertyStore.fetchWorkerInterface(this.image);
    }
  }
}
</script>
