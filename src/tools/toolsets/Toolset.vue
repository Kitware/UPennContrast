<template>
  <v-expansion-panels v-model="panels">
    <v-expansion-panel expand v-model="panels">
      <v-expansion-panel-header class="pa-4">
        <v-toolbar-title> Annotation Tools </v-toolbar-title>
        <v-spacer></v-spacer>
        <!-- Tool creation -->
        <v-dialog v-model="toolCreationDialogOpen" width="unset">
          <template v-slot:activator="{ on: dialog }">
            <v-tooltip top>
              <template v-slot:activator="{ on: tooltip }">
                <v-btn icon v-on="{ ...dialog, ...tooltip }">
                  <v-icon>
                    {{ "mdi-plus" }}
                  </v-icon>
                </v-btn>
              </template>
              <span>Create new tool</span>
            </v-tooltip>
          </template>
          <tool-creation
            @done="toolCreationDialogOpen = false"
            :open="toolCreationDialogOpen"
          />
        </v-dialog>
        <!-- Add tools to the toolset -->
        <v-dialog v-model="toolPickerDialogOpen" width="unset">
          <template v-slot:activator="{ on: dialog }">
            <v-tooltip top>
              <template v-slot:activator="{ on: tooltip }">
                <v-btn icon v-on="{ ...tooltip, ...dialog }">
                  <v-icon rounded medium>{{ "mdi-magnify" }}</v-icon>
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
      </v-expansion-panel-header>
      <v-expansion-panel-content>
        <!-- List toolset tools -->
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
          <annotation-worker-menu
            :tool="selectedTool"
            v-if="selectedTool && selectedTool.type === 'segmentation'"
          ></annotation-worker-menu>
        </v-list>
        <v-subheader
          v-if="!toolset || !toolset.toolIds || !toolsetTools.length"
        >
          No tools in the current toolset.
        </v-subheader>
      </v-expansion-panel-content>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
import toolsStore from "@/store/tool";
import { IToolConfiguration } from "@/store/model";
import ToolIcon from "@/tools/ToolIcon.vue";
import ToolsetPicker from "@/tools/toolsets/ToolsetPicker.vue";
import ToolCreation from "@/tools/creation/ToolCreation.vue";
import AnnotationWorkerMenu from "@/components/AnnotationWorkerMenu.vue";

// Lists tools from a toolset, allows selecting a tool from the list, and adding new tools
@Component({
  components: { ToolCreation, ToolIcon, ToolsetPicker, AnnotationWorkerMenu }
})
export default class Toolset extends Vue {
  readonly store = store;
  readonly toolsStore = toolsStore;

  panels: number = 0;

  get selectedToolId() {
    return this.toolsStore.selectedToolId || "";
  }

  set selectedToolId(id: string) {
    this.toolsStore.setSelectedToolId(id);
  }

  get toolset() {
    return this.store.configuration?.toolset;
  }

  get tools() {
    return this.toolsStore.tools;
  }

  get toolsetTools() {
    return (
      this.toolset?.toolIds.map(this.getToolById).filter(tool => !!tool) || []
    );
  }

  get configuration() {
    return this.store.configuration;
  }

  get selectedTool(): IToolConfiguration | null {
    if (!this.selectedToolId) {
      return null;
    }
    const tool = this.toolsStore.tools.find(
      (tool: IToolConfiguration) => tool.id === this.selectedToolId
    );
    return tool || null;
  }

  toolCreationDialogOpen: boolean = false;
  toolPickerDialogOpen: boolean = false;

  getToolById(toolId: string) {
    return this.toolsStore.tools.find(
      (tool: IToolConfiguration) => tool.id === toolId
    );
  }

  removeToolId(toolId: string) {
    if (toolId === this.selectedToolId) {
      this.selectedToolId = "";
    }
    this.toolsStore.removeToolIdFromCurrentToolset({ id: toolId });
    this.store.syncConfiguration();
  }

  mounted() {
    this.toolsStore.refreshToolsInCurrentToolset();
  }

  @Watch("configuration")
  toolsetChanged() {
    this.toolsStore.refreshToolsInCurrentToolset();
  }
}
</script>
<style scoped>
.v-list {
  width: 100%;
  /* height: 40vh; */
  overflow-y: auto;
}
</style>
