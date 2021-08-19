<template>
  <v-card>
    <v-card-title>
      Add a new tool
    </v-card-title>
    <v-card-text>
      <tool-type-selection v-model="selectedItemTemplate">
      </tool-type-selection>
      <tool-configuration
        v-if="selectedItemTemplate"
        :template="selectedItemTemplate"
        v-model="toolValues"
        @submit="createTool"
        @reset="reset"
      />
    </v-card-text>
    <v-card-actions>
      <div class="button-bar">
        <v-spacer></v-spacer>
        <v-btn class="mr-4" color="primary" @click="createTool">
          ADD TOOL
        </v-btn>
        <v-btn class="mr-4" color="secondary" @click="reset">RESET</v-btn>
        <v-btn class="mr-4" color="warning" @click="close">CANCEL</v-btn>
      </div>
    </v-card-actions>
  </v-card>
</template>
<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import ToolConfiguration from "@/tools/creation/ToolConfiguration.vue";
import ToolTypeSelection from "@/tools/creation/ToolTypeSelection.vue";

const defaultValues = {
  name: "New Tool",
  description: ""
};

@Component({
  components: {
    ToolConfiguration,
    ToolTypeSelection
  }
})
export default class ToolCreation extends Vue {
  readonly store = store;

  toolValues: any = { ...defaultValues };

  selectedItemTemplate: any = null;
  errorMessages: string[] = [];
  successMessages: string[] = [];

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
      this.store.createTool({ name, description }).then(tool => {
        if (tool === null) {
          console.error("Failed to create a new tool on the server");
          return;
        }
        tool.template = this.selectedItemTemplate;
        tool.values = this.toolValues;
        tool.type = this.selectedItemTemplate.type;
        // Update this tool with actual values
        this.store.updateTool(tool).then(() => {
          this.store.syncConfiguration();
        });
        this.close();
      });
    }
  }

  reset() {
    this.toolValues = { ...defaultValues };
  }

  close() {
    this.reset();
    this.$emit("done");
  }
}
</script>
