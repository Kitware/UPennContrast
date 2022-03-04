<template>
  <v-dialog v-model="show" v-if="tool">
    <v-card v-if="tool">
      <v-card-title> Annotation Worker Menu </v-card-title>
      <v-card-text>
        <v-container>
          <v-row>
            <v-col>
              <v-subheader>Tool: {{ tool.name }}</v-subheader>
            </v-col>
            <v-col>
              <v-subheader>Image: {{ tool.values.image.image }}</v-subheader>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="6">
              <worker-interface
                :workerInterface="workerInterface"
                @preview="preview"
                @compute="compute"
              >
              </worker-interface>
            </v-col>
            <v-col cols="6">
              <worker-preview
                v-if="workerPreview"
                :workerPreview="workerPreview"
              ></worker-preview>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>
      <v-card-actions>
        <v-btn @click="show = false">CANCEL</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
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
import WorkerPreview from "@/components/WorkerPreview.vue";
// Popup for new tool configuration
@Component({
  components: {
    LayerSelect,
    TagFilterEditor,
    DockerImageSelect,
    WorkerInterface,
    WorkerPreview
  }
})
export default class annotationWorkerMenu extends Vue {
  readonly store = store;
  readonly annotationsStore = annotationsStore;
  readonly propertyStore = propertiesStore;

  @VModel()
  show!: boolean;

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
    this.annotationsStore.computeAnnotationsWithWorker({
      tool: this.tool,
      workerInterface: interfaceValues
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

  @Watch("show")
  updateInterface() {
    if (Object.keys(this.workerInterface).length === 0) {
      this.propertyStore.fetchWorkerInterface(this.image);
    }
  }
}
</script>
