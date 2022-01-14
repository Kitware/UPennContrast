<template>
  <v-dialog v-model="show" v-if="tool">
    <v-card>
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
        </v-container>
      </v-card-text>
      <v-card-actions>
        <v-btn @click="show = false">CANCEL</v-btn>
        <v-spacer></v-spacer>
        <v-btn @click="compute">COMPUTE</v-btn>
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

// Popup for new tool configuration
@Component({ components: { LayerSelect, TagFilterEditor, DockerImageSelect } })
export default class annotationWorkerMenu extends Vue {
  readonly store = store;
  readonly annotationsStore = annotationsStore;

  @VModel({ type: Boolean }) show!: Boolean;

  @Prop()
  readonly tool!: IToolConfiguration;

  compute() {
    this.annotationsStore.computeAnnotationsWithWorker(this.tool);
    this.show = false;
  }
}
</script>
