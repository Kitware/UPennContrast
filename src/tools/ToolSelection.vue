<template>
  <v-container>
    <v-select
      v-model="selectedItemTemplate"
      :items="templates"
      item-text="name"
      item-value="type"
      label="Select a tool type to add"
      return-object
    >
    </v-select>
    <tool-configuration
      v-if="selectedItemTemplate"
      :template="selectedItemTemplate"
      v-model="toolValues"
      @submit="createTool"
    />
  </v-container>
</template>
<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import ToolConfiguration from "@/tools/ToolConfiguration.vue";

@Component({
  components: {
    ToolConfiguration
  }
})
export default class ToolSelection extends Vue {
  readonly store = store;

  toolValues: any = {};

  selectedItemTemplate: any = null;
  errorMessages: string[] = [];
  successMessages: string[] = [];

  get templates() {
    return this.store.toolTemplateList;
  }
  mounted() {
    this.initialize();
  }

  @Watch("templates")
  initialize() {
    // Set initial value
    if (!this.selectedItemTemplate && this.templates.length) {
      this.selectedItemTemplate = this.templates[0];
    }
  }

  createTool() {
    if (this.selectedItemTemplate) {
      const tool = {
        type: this.selectedItemTemplate.type,
        template: this.selectedItemTemplate,
        values: this.toolValues
      };
      const name = tool.values.name || "Unnamed Tool";
      const description = tool.values.description || "";
      // Create an empty tool to get the id
      this.store.api.createTool(name, description).then(tool => {
        if (tool === null) {
          console.error("Failed to create a new tool on the server");
          return;
        }
        tool.template = this.selectedItemTemplate;
        tool.values = this.toolValues;
        tool.type = this.selectedItemTemplate.type;
        // Update this tool with actual values
        this.store.updateTool(tool);
        this.$emit("done");
      });
    }
  }
}
</script>
