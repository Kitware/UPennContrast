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

  createTool() {
    if (this.selectedItemTemplate) {
      const tool = {
        type: this.selectedItemTemplate.type,
        template: this.selectedItemTemplate,
        values: this.toolValues
      };
      console.log(this.store, "tool", tool);
      this.store.addTool({ id: tool.values.name, tool });
    }
  }
}
</script>
