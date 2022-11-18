<template>
  <div>
    <v-card class="pa-1">
      <v-card-title>
        Add a new tool
      </v-card-title>
      <v-card-text>
        <!-- Pick which template should be used for the tool configuration -->
        <tool-type-selection v-model="selectedTool" />
        <!-- Form elements generated from the template -->
        <tool-configuration
          :template="selectedTemplate"
          :defaultValues="selectedDefaultValues"
          v-model="toolValues"
          @submit="createTool"
          @reset="reset"
          ref="toolConfiguration"
        />
        <!-- Tool name with autofill -->
        <v-card v-if="selectedTemplate" flat class="pa-4 ma-0">
          <v-card-title class="pa-0 ma-0">
            Tool Name
          </v-card-title>
          <v-text-field
            v-model="toolName"
            :append-icon="userToolName ? 'mdi-refresh' : ''"
            @click:append="userToolName = false"
            @input="userToolName = true"
            dense
            class="px-4 py-0 ma-0"
          />
        </v-card>
      </v-card-text>
      <v-card-actions>
        <v-container class="button-bar ma-0 pa-0">
          <v-spacer></v-spacer>
          <v-btn
            class="mr-4"
            color="primary"
            @click="createTool"
            :disabled="!selectedTemplate"
          >
            ADD TOOL TO THE CURRENT TOOLSET
          </v-btn>
          <v-btn class="mr-4" color="warning" @click="close">CANCEL</v-btn>
        </v-container>
      </v-card-actions>
    </v-card>
  </div>
</template>
<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
import toolsStore from "@/store/tool";
import propertiesStore from "@/store/properties";
import { AnnotationNames, AnnotationShape } from "@/store/model";

import ToolConfiguration from "@/tools/creation/ToolConfiguration.vue";
import ToolTypeSelection from "@/tools/creation/ToolTypeSelection.vue";
import { logError } from "@/utils/log";

const defaultValues = {
  name: "New Tool",
  description: ""
};

// Popup for new tool configuration
@Component({
  components: {
    ToolConfiguration,
    ToolTypeSelection
  }
})
export default class ToolCreation extends Vue {
  readonly store = store;
  readonly toolsStore = toolsStore;
  readonly propertyStore = propertiesStore;

  toolValues: any = { ...defaultValues };

  selectedTemplate: any = null;
  selectedDefaultValues: any = null;

  errorMessages: string[] = [];
  successMessages: string[] = [];

  userToolName = false;
  toolName = "New Tool";

  @Prop()
  readonly open: any;

  createTool() {
    const name = this.toolName || "Unnamed Tool";
    // Create an empty tool to get the id
    this.toolsStore.createTool({ name, description: "" }).then(tool => {
      if (tool === null) {
        logError("Failed to create a new tool on the server");
        return;
      }
      tool.template = this.selectedTemplate;
      tool.values = this.toolValues;
      tool.type = this.selectedTemplate.type;
      if (tool.type === "segmentation") {
        const { image } = tool.values.image;
        this.propertyStore.requestWorkerInterface(image);
      }

      // Update this tool with actual values
      this.toolsStore.updateTool(tool).then(() => {
        this.store.syncConfiguration();
      });

      // Add this tool to the current toolset
      this.toolsStore.addToolIdsToCurrentToolset({ ids: [tool.id] });

      // Save
      this.store.syncConfiguration();

      this.close();
    });
  }

  private _selectedTool: any = null;

  set selectedTool(value: any) {
    this._selectedTool = value;
    this.selectedTemplate = value.template;
    this.selectedDefaultValues = value.defaultValues;
  }

  get selectedTool() {
    return this.selectedTemplate ? this._selectedTool : null;
  }

  @Watch("selectedTemplate")
  @Watch("toolValues")
  @Watch("userToolName")
  updateAutoToolName() {
    if (this.userToolName) {
      return;
    }
    if (this.toolValues?.annotation) {
      const toolNameStrings: string[] = [];
      toolNameStrings.push(this.toolValues?.annotation.tags.join(", "));
      const layerIdx = this.toolValues?.annotation.coordinateAssignments.layer;
      if (typeof layerIdx === "number") {
        const layerName = this.store.configuration?.view.layers[layerIdx].name;
        if (layerName) {
          toolNameStrings.push(layerName);
        }
      }
      const toolShape: AnnotationShape = this.toolValues?.annotation.shape;
      toolNameStrings.push(AnnotationNames[toolShape]);
      this.toolName = toolNameStrings.join(" ");
      return;
    }
    if (this.selectedTemplate) {
      this.toolName = this.selectedTemplate.name;
      return;
    }
    this.toolName = "New Tool";
  }

  @Watch("open")
  reset() {
    this.userToolName = false;
    this.toolName = "New Tool";
    this.selectedTemplate = null;
    this.selectedDefaultValues = null;

    if (!this.$refs.toolConfiguration) {
      return;
    }

    const toolConfiguration = this.$refs.toolConfiguration as ToolConfiguration;
    if (toolConfiguration) {
      toolConfiguration.reset();
    }
  }

  close() {
    this.reset();
    this.$emit("done");
  }
}
</script>
