<template>
  <v-list-item
    dense
    :value="tool.id"
    :style="{ 'max-height': '32px' }"
    v-mousetrap="
      tool.hotkey
        ? {
            bind: tool.hotkey,
            handler: toggleTool,
            data: {
              section: 'Tools',
              description: `Toggle tool:  ${tool.name}`,
            },
          }
        : []
    "
    v-bind="$attrs"
    v-on="$listeners"
    @mouseover="isHovering = true"
    @mouseleave="isHovering = false"
  >
    <v-list-item-avatar>
      <tool-icon :tool="tool" />
    </v-list-item-avatar>
    <v-list-item-content>
      <v-list-item-title>{{ tool.name }}</v-list-item-title>
    </v-list-item-content>
    <v-list-item-action v-if="isHovering">
      <v-btn icon :max-height="32" @click.stop="editDialog = true">
        <v-icon>mdi-pen</v-icon>
      </v-btn>
    </v-list-item-action>
    <v-dialog v-model="editDialog">
      <tool-edition :tool="tool" @close="editDialog = false" />
    </v-dialog>
  </v-list-item>
</template>

<script lang="ts">
import { IToolConfiguration } from "@/store/model";
import { Vue, Component, Prop } from "vue-property-decorator";
import store from "@/store";
import ToolIcon from "@/tools/ToolIcon.vue";
import ToolEdition from "@/tools/ToolEdition.vue";

@Component({
  components: { ToolIcon, ToolEdition },
})
export default class Toolset extends Vue {
  readonly store = store;
  @Prop()
  tool!: IToolConfiguration;

  isHovering = false;
  editDialog = false;

  toggleTool() {
    if (this.isSelectedTool()) {
      this.store.setSelectedToolId(null);
    } else {
      this.store.setSelectedToolId(this.tool.id);
    }
  }

  isSelectedTool() {
    return this.store.selectedTool?.id === this.tool.id;
  }
}
</script>
