<template>
  <v-expansion-panels v-model="panels">
    <v-expansion-panel expand v-model="panels">
      <v-expansion-panel-header class="pa-4">
        <v-toolbar-title> Annotation Tools </v-toolbar-title>
        <!-- Tool creation -->
        <v-dialog v-model="toolCreationDialogOpen" width="60%">
          <template v-slot:activator="{ on: dialog }">
            <v-tooltip top>
              <template v-slot:activator="{ on: tooltip }">
                <v-btn
                  class="rounded-pill"
                  icon
                  v-on="{ ...dialog, ...tooltip }"
                >
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
      </v-expansion-panel-header>
      <v-expansion-panel-content>
        <!-- List toolset tools -->
        <v-list v-if="toolsetTools.length" dense>
          <v-list-item-group v-model="selectedToolId">
            <draggable>
              <template v-for="(tool, index) in toolsetTools">
                <v-tooltip
                  right
                  transition="none"
                  z-index="100"
                  :key="index"
                  v-if="tool"
                >
                  <template v-slot:activator="{ on, attrs }">
                    <v-list-item
                      dense
                      :value="tool.id"
                      v-bind="attrs"
                      v-on="on"
                      v-mousetrap="
                        tool.hotkey
                          ? {
                              bind: tool.hotkey,
                              handler: () =>
                                (selectedToolId =
                                  selectedToolId === tool.id ? '' : tool.id)
                            }
                          : []
                      "
                    >
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
                  <div class="d-flex flex-column">
                    <div style="margin: 5px;">
                      <div
                        v-for="(propEntry,
                        forKey) in getToolPropertiesDescription(tool)"
                        :key="forKey"
                      >
                        {{ propEntry[0] }}: {{ propEntry[1] }}
                      </div>
                    </div>
                  </div>
                </v-tooltip>
              </template>
            </draggable>
          </v-list-item-group>
          <annotation-worker-menu
            :tool="selectedTool"
            v-if="selectedTool && selectedTool.type === 'segmentation'"
          ></annotation-worker-menu>
          <circle-to-dot-menu
            :tool="selectedTool"
            v-if="
              selectedTool &&
                selectedTool.type === 'snap' &&
                selectedTool.values.snapTo.value === 'circleToDot'
            "
          />
        </v-list>
        <v-subheader v-if="!toolsetTools.length">
          No tools in the current toolset.
        </v-subheader>
      </v-expansion-panel-content>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import draggable from "vuedraggable";
import store from "@/store";
import toolsStore from "@/store/tool";
import {
  AnnotationNames,
  AnnotationShape,
  IToolConfiguration
} from "@/store/model";
import ToolIcon from "@/tools/ToolIcon.vue";
import ToolCreation from "@/tools/creation/ToolCreation.vue";
import AnnotationWorkerMenu from "@/components/AnnotationWorkerMenu.vue";
import CircleToDotMenu from "@/components/CircleToDotMenu.vue";

// Lists tools from a toolset, allows selecting a tool from the list, and adding new tools
@Component({
  components: {
    ToolCreation,
    ToolIcon,
    AnnotationWorkerMenu,
    CircleToDotMenu,
    draggable
  }
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

  get tools() {
    return this.toolsStore.tools;
  }

  get toolsetTools() {
    return this.configuration?.tools || [];
  }

  get configuration() {
    return this.store.configuration;
  }

  get selectedTool(): IToolConfiguration | null {
    return this.toolsStore.selectedTool;
  }

  toolCreationDialogOpen: boolean = false;
  toolPickerDialogOpen: boolean = false;

  getToolById(toolId: string) {
    return this.toolsStore.tools.find(
      (tool: IToolConfiguration) => tool.id === toolId
    );
  }

  getToolPropertiesDescription(tool: IToolConfiguration): string[][] {
    const propDesc: string[][] = [["Name", tool.name]];

    if (tool.description) {
      propDesc.push(["Description", tool.description]);
    }

    if (tool.values) {
      const { values } = tool;

      if (values.selectionType && values.selectionType.text) {
        propDesc.push(["Selection type", values.selectionType.text]);
      }

      if (values.annotation) {
        propDesc.push([
          "Shape",
          AnnotationNames[values.annotation.shape as AnnotationShape]
        ]);
        if (values.annotation.tags && values.annotation.tags.length) {
          propDesc.push(["Tag(s)", values.annotation.tags.join(", ")]);
        }
      }
      if (
        values.connectTo &&
        values.connectTo.tags &&
        values.connectTo.tags.length
      ) {
        propDesc.push(["Connect to tags", values.connectTo.tags.join(", ")]);
        const layerIdx = values.connectTo.layer;
        const layers = this.store.configuration?.layers;
        if (layers && typeof values.connectTo.layer === "number") {
          propDesc.push(["Connect only on layer", layers[layerIdx].name]);
        }
      }
    }

    return propDesc;
  }

  removeToolId(toolId: string) {
    if (toolId === this.selectedToolId) {
      this.selectedToolId = "";
    }
    this.toolsStore.removeToolIdFromCurrentToolset({ id: toolId });
    this.store.syncConfiguration("tools");
  }
}
</script>
<style scoped>
.v-list {
  width: 100%;
  /* height: 40vh; */
  overflow-y: auto;
  overflow-x: hidden;
}
</style>
