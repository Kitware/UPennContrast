<template>
  <!-- tags -->
  <v-combobox
    v-model="tags"
    :items="tagList"
    :search-input.sync="tagSearchInput"
    multiple
    hide-selected
    hide-details
    small-chips
    dense
  >
    <template v-slot:selection="{ attrs, index, item, parent }">
      <v-chip
        :key="index"
        class="pa-2"
        v-bind="attrs"
        close
        pill
        x-small
        @click:close="parent.selectItem(item)"
      >
        {{ item }}
      </v-chip>
    </template>
  </v-combobox>
</template>

<script lang="ts">
import { Vue, Component, VModel } from "vue-property-decorator";
import store from "@/store";
import toolsStore from "@/store/tool";
import { IToolConfiguration } from "@/store/model";

// Interface element for the input of annotation tags
@Component({
  components: {}
})
export default class TagPicker extends Vue {
  readonly store = store;
  readonly toolsStore = toolsStore;

  @VModel({ type: Array }) tags!: string[];

  get tagList(): string[] {
    return this.toolsStore.tools
      .filter(
        (tool: IToolConfiguration) =>
          (tool.type === "create" || tool.type === "snap") &&
          tool.values.annotation
      )
      .map((tool: IToolConfiguration) => tool.values.annotation.tags)
      .flat();
  }

  tagSearchInput: string = "";
  get layers() {
    return this.store.configuration?.view.layers || [];
  }
}
</script>
