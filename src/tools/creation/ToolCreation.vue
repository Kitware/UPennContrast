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
          ref="toolConfiguration"
        />
        <v-container v-if="selectedTemplate" class="pa-4">
          <!-- Tool name with autofill -->
          <v-row dense>
            <v-col>
              <div class="title white--text">
                Tool Name
              </div>
            </v-col>
          </v-row>
          <v-row dense class="px-4">
            <v-col>
              <v-text-field
                v-model="toolName"
                :append-icon="userToolName ? 'mdi-refresh' : ''"
                @click:append="userToolName = false"
                @input="userToolName = true"
                dense
              />
            </v-col>
          </v-row>
          <!-- Tool hotkey -->
          <v-row dense>
            <v-col>
              <div class="title white--text">
                Tool Hotkey
              </div>
            </v-col>
          </v-row>
          <v-row dense class="px-4">
            <v-col>
              <hotkey-selection v-model="hotkey" />
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>
      <v-card-actions>
        <v-container class="button-bar ma-0 pa-0">
          <v-spacer />
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
import propertiesStore from "@/store/properties";
import {
  AnnotationNames,
  AnnotationShape,
  IToolConfiguration
} from "@/store/model";

import ToolConfiguration from "@/tools/creation/ToolConfiguration.vue";
import ToolTypeSelection from "@/tools/creation/ToolTypeSelection.vue";
import HotkeySelection from "@/components/HotkeySelection.vue";
import { v4 as uuidv4 } from "uuid";

const defaultValues = {
  name: "New Tool",
  description: ""
};

// Popup for new tool configuration
@Component({
  components: {
    ToolConfiguration,
    ToolTypeSelection,
    HotkeySelection
  }
})
export default class ToolCreation extends Vue {
  readonly store = store;
  readonly propertyStore = propertiesStore;

  toolValues: any = { ...defaultValues };

  selectedTemplate: any = null;
  selectedDefaultValues: any = null;

  errorMessages: string[] = [];
  successMessages: string[] = [];

  userToolName = false;
  toolName = "New Tool";

  hotkey: string | null = null;

  @Prop()
  readonly open: any;

  createTool() {
    const tool: IToolConfiguration = {
      id: uuidv4(),
      name: this.toolName || "Unnamed Tool",
      template: this.selectedTemplate,
      values: this.toolValues,
      type: this.selectedTemplate.type,
      hotkey: this.hotkey
    };

    // Add this tool to the current toolset
    this.store.addToolToConfiguration(tool);

    this.close();
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
    const toolNameStrings: string[] = [];
    if (this.toolValues?.annotation) {
      toolNameStrings.push(this.toolValues.annotation.tags.join(", "));
      const layerIdx = this.toolValues.annotation.coordinateAssignments.layer;
      if (typeof layerIdx === "number") {
        const layerName = this.store.layers[layerIdx].name;
        if (layerName) {
          toolNameStrings.push(layerName);
        }
      }
    }
    if (this.selectedTemplate?.shortName) {
      toolNameStrings.push(this.selectedTemplate.shortName);
    }
    if (this.toolValues?.action) {
      toolNameStrings.push(this.toolValues.action.text);
    }
    if (this.toolValues?.annotation) {
      const toolShape: AnnotationShape = this.toolValues.annotation.shape;
      toolNameStrings.push(AnnotationNames[toolShape]);
    }
    if (this.toolValues?.parentAnnotation && this.toolValues?.childAnnotation) {
      const parentValues = this.toolValues.parentAnnotation;
      const childValues = this.toolValues.childAnnotation;
      const newString =
        (parentValues.tags.join(", ") ||
          (parentValues.tagsInclusive ? "None" : "All")) +
        " to " +
        (childValues.tags.join(", ") ||
          (childValues.tagsInclusive ? "None" : "All"));
      toolNameStrings.push(newString);
    }
    if (toolNameStrings.length > 0) {
      this.toolName = toolNameStrings.join(" ");
      return;
    }
    if (this._selectedTool?.selectedItem?.text) {
      toolNameStrings.push(this._selectedTool?.selectedItem?.text);
    }
    if (this.selectedTemplate) {
      toolNameStrings.push(this.selectedTemplate.name);
    }
    if (toolNameStrings.length > 0) {
      this.toolName = toolNameStrings.join(" ");
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
