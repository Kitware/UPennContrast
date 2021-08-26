<template>
  <v-card>
    <v-app-bar dense>
      <v-toolbar-title>
        Current Toolset
      </v-toolbar-title>
      <v-spacer></v-spacer>
      <!-- Tool creation -->
      <v-dialog v-model="toolCreationDialogOpen" width="unset">
        <template v-slot:activator="{ on: dialog }">
          <v-tooltip top>
            <template v-slot:activator="{ on: tooltip }">
              <v-btn icon v-on="{ ...dialog, ...tooltip }">
                <v-icon>
                  {{ "mdi-file-star-outline" }}
                </v-icon>
              </v-btn>
            </template>
            <span>Create new tool</span>
          </v-tooltip>
        </template>
        <tool-creation @done="toolCreationDialogOpen = false" />
      </v-dialog>
      <!-- Add tools to the toolset -->
      <v-dialog v-model="toolPickerDialogOpen" width="unset">
        <template v-slot:activator="{ on: dialog }">
          <v-tooltip top>
            <template v-slot:activator="{ on: tooltip }">
              <v-btn icon v-on="{ ...tooltip, ...dialog }">
                <v-icon round medium>{{ "mdi-plus" }}</v-icon>
              </v-btn>
            </template>
            <span>Add existing tools</span>
          </v-tooltip>
        </template>
        <v-card>
          <v-card-title>
            Choose a tool to add to this toolset
          </v-card-title>
          <v-card-text>
            <toolset-picker @done="toolPickerDialogOpen = false" />
          </v-card-text>
        </v-card>
      </v-dialog>
    </v-app-bar>
    <v-list v-if="toolset && toolset.toolIds && toolsetTools.length" dense>
      <v-list-item-group v-model="selectedToolId">
        <template v-for="(tool, index) in toolsetTools">
          <v-list-item dense :key="index" :value="tool.id">
            <v-list-item-avatar>
              <tool-icon :tool="tool" />
            </v-list-item-avatar>
            <v-list-item-content
              ><v-list-item-title>{{ tool.name }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ tool.description }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action
              ><v-btn icon @click="removeToolId(tool.id)"
                ><v-icon>mdi-close</v-icon></v-btn
              ></v-list-item-action
            >
          </v-list-item>
        </template>
      </v-list-item-group>
    </v-list>
    <v-card-subtitle v-else>
      <v-subheader>
        No tools in the current toolset.
      </v-subheader>
    </v-card-subtitle>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
import { IToolConfiguration } from "@/store/model";
import ToolIcon from "@/tools/ToolIcon.vue";
import ToolsetPicker from "@/tools/toolsets/ToolsetPicker.vue";
import ToolCreation from "@/tools/creation/ToolCreation.vue";

@Component({
  components: { ToolCreation, ToolIcon, ToolsetPicker }
})
export default class Toolset extends Vue {
  readonly store = store;

  get selectedToolId() {
    return this.store.selectedToolId || "";
  }

  set selectedToolId(id: string) {
    this.store.setSelectedToolId(id);
  }

  get toolset() {
    return this.store.configuration?.toolset;
  }

  get tools() {
    return this.store.tools;
  }

  get toolsetTools() {
    return (
      this.toolset?.toolIds.map(this.getToolById).filter(tool => !!tool) || []
    );
  }

  get configuration() {
    return this.store.configuration;
  }

  toolCreationDialogOpen: boolean = false;
  toolPickerDialogOpen: boolean = false;

  getToolById(toolId: string) {
    return this.store.tools.find(
      (tool: IToolConfiguration) => tool.id === toolId
    );
  }

  removeToolId(toolId: string) {
    if (toolId === this.selectedToolId) {
      this.selectedToolId = "";
    }
    this.store.removeToolIdFromCurrentToolset({ id: toolId });
    this.store.syncConfiguration();
  }

  mounted() {
    this.store.refreshToolsInCurrentToolset();
  }

  @Watch("configuration")
  toolsetChanged() {
    this.store.refreshToolsInCurrentToolset();
  }
}
</script>
<style scoped>
.v-list {
  width: 100%;
  height: 30vh;
  overflow-y: auto;
}
</style>
