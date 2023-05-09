<template>
  <v-list-item
    dense
    :value="tool.id"
    v-mousetrap="
      tool.hotkey
        ? {
            bind: tool.hotkey,
            handler: toggleTool
          }
        : []
    "
  >
    <v-list-item-avatar>
      <tool-icon :tool="tool" />
    </v-list-item-avatar>
    <v-list-item-content
      ><v-list-item-title>{{ tool.name }}</v-list-item-title>
    </v-list-item-content>
    <v-list-item-action
      ><v-btn icon @click="removeTool()"
        ><v-icon>mdi-close</v-icon></v-btn
      ></v-list-item-action
    >
  </v-list-item>
</template>

<script lang="ts">
import { IToolConfiguration } from "@/store/model";
import { Vue, Component, Prop } from "vue-property-decorator";
import store from "@/store";
import ToolIcon from "@/tools/ToolIcon.vue";

@Component({
  components: { ToolIcon }
})
export default class Toolset extends Vue {
  readonly store = store;
  @Prop()
  tool!: IToolConfiguration;

  toggleTool() {
    if (this.isSelectedTool()) {
      this.store.setSelectedToolId(null);
    } else {
      this.store.setSelectedToolId(this.tool.id);
    }
  }

  removeTool() {
    this.store.removeToolFromConfiguration(this.tool.id);
  }

  isSelectedTool() {
    return this.store.selectedTool?.id === this.tool.id;
  }
}
</script>
