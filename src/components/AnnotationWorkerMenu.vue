<template>
  <v-card v-if="tool" class="menu">
    <v-card-title class="subtitle-1">
      Worker menu
    </v-card-title>
    <v-card-text>
      <v-container v-if="fetchingWorkerInterface">
        <v-progress-circular indeterminate />
      </v-container>
      <v-container v-else>
        <v-row v-if="running">
          <v-progress-linear
            :indeterminate="!progressInfo.progress"
            :value="100 * (progressInfo.progress || 0)"
            style="height: 20px;"
          >
            <strong class="pr-4">
              {{ progressInfo.title }}
            </strong>
            {{ progressInfo.info }}
          </v-progress-linear>
        </v-row>
        <v-row>
          <v-col>
            <v-subheader>Image: {{ tool.values.image.image }}</v-subheader>
          </v-col>
        </v-row>
        <v-row>
          <worker-interface-values
            :workerInterface="workerInterface"
            v-model="interfaceValues"
          />
        </v-row>
        <v-row>
          <v-btn @click="preview">preview</v-btn>
          <v-spacer></v-spacer>
          <v-btn @click="compute" :disabled="running">
            <v-progress-circular size="16" v-if="running" indeterminate />
            <v-icon v-if="previousRunStatus === false">mdi-close</v-icon>
            <v-icon v-if="previousRunStatus === true">mdi-check</v-icon>
            <span>Compute</span>
          </v-btn>
        </v-row>
        <v-row>
          <v-checkbox
            v-model="displayWorkerPreview"
            label="Display Previews"
          ></v-checkbox>
        </v-row>
      </v-container>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
import annotationsStore from "@/store/annotation";
import {
  IProgressInfo,
  IToolConfiguration,
  IWorkerInterfaceValues
} from "@/store/model";
import TagFilterEditor from "@/components/AnnotationBrowser/TagFilterEditor.vue";
import LayerSelect from "@/components/LayerSelect.vue";
import propertiesStore from "@/store/properties";
import WorkerInterfaceValues from "@/components/WorkerInterfaceValues.vue";
// Popup for new tool configuration
@Component({
  components: {
    LayerSelect,
    TagFilterEditor,
    WorkerInterfaceValues
  }
})
export default class annotationWorkerMenu extends Vue {
  readonly store = store;
  readonly annotationsStore = annotationsStore;
  readonly propertyStore = propertiesStore;

  fetchingWorkerInterface: boolean = false;
  running: boolean = false;
  previousRunStatus: boolean | null = null;
  progressInfo: IProgressInfo = {};

  interfaceValues: IWorkerInterfaceValues = {};

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

  get displayWorkerPreview() {
    return this.propertyStore.displayWorkerPreview;
  }

  set displayWorkerPreview(value: boolean) {
    this.propertyStore.setDisplayWorkerPreview(value);
  }

  compute() {
    if (this.running) {
      return;
    }
    this.running = true;
    this.previousRunStatus = null;
    this.annotationsStore.computeAnnotationsWithWorker({
      tool: this.tool,
      workerInterface: this.interfaceValues,
      progress: this.progressInfo,
      callback: success => {
        this.running = false;
        this.previousRunStatus = success;
        this.progressInfo = {};
      }
    });
  }

  preview() {
    this.propertyStore.requestWorkerPreview({
      image: this.image,
      tool: this.tool,
      workerInterface: this.interfaceValues
    });
  }

  mounted() {
    this.updateInterface();
  }

  @Watch("tool")
  async updateInterface() {
    if (
      Object.keys(this.workerInterface).length === 0 &&
      !this.fetchingWorkerInterface
    ) {
      this.fetchingWorkerInterface = true;
      await this.propertyStore.fetchWorkerInterface(this.image).finally();
      this.fetchingWorkerInterface = false;
    }
  }
}
</script>

<style lang="scss" scoped>
.menu {
  border: solid 10px rgba($color: #888, $alpha: 0.5);
}
</style>
