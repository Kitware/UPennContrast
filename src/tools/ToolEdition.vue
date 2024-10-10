<template>
  <v-card>
    <v-card-title>
      <span class="headline">Edit tool:</span>
      <v-text-field
        dense
        hide-details
        class="ma-0 ml-2 headline"
        v-model="toolName"
      />
    </v-card-title>
    <v-card-text>
      <tool-configuration
        :template="tool.template"
        :defaultValues="tool.values"
        v-model="toolValues"
        ref="toolConfiguration"
      />
      <div class="ma-6 mb-0">
        <div class="title white--text">Tool Hotkey</div>
        <hotkey-selection v-model="toolHotkey" />
      </div>
    </v-card-text>
    <v-card-actions class="py-4">
      <v-btn @click="removeTool" color="red" class="mr-4">
        Delete tool
        <v-icon class="ml-1">mdi-delete</v-icon>
      </v-btn>
      <v-spacer />
      <v-btn @click="cancel" color="warning" class="mr-4">
        Cancel
        <v-icon class="ml-1">mdi-undo</v-icon>
      </v-btn>
      <v-btn @click="submit" color="primary" class="mr-4">
        Update tool
        <v-icon class="ml-1">mdi-check</v-icon>
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts">
import { IToolConfiguration } from "@/store/model";
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import store from "@/store";

import ToolConfiguration from "@/tools/creation/ToolConfiguration.vue";
import HotkeySelection from "@/components/HotkeySelection.vue";

@Component({
  components: { ToolConfiguration, HotkeySelection },
})
export default class ToolEdition extends Vue {
  readonly store = store;
  @Prop()
  tool!: IToolConfiguration;

  readonly $refs!: {
    toolConfiguration?: ToolConfiguration;
  };

  toolValues: any = {};
  toolName: string = "";
  toolHotkey: string | null = null;

  mounted() {
    this.reset();
  }

  @Watch("tool")
  reset() {
    this.toolName = this.tool.name;
    this.toolHotkey = this.tool.hotkey;

    const toolConfiguration = this.$refs.toolConfiguration;
    if (toolConfiguration) {
      // Should reset toolValues
      toolConfiguration.reset();
    }
  }

  submit() {
    const newTool: IToolConfiguration = {
      ...this.tool,
      name: this.toolName,
      hotkey: this.toolHotkey,
      values: this.toolValues,
    };
    this.store.editToolInConfiguration(newTool);
    this.$emit("close");
  }

  cancel() {
    this.reset();
    this.$emit("close");
  }

  removeTool() {
    this.store.removeToolFromConfiguration(this.tool.id);
    this.$emit("close");
  }
}
</script>
