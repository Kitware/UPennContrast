<template>
  <v-list v-if="toolset && toolset.toolIds" dense>
    <v-list-item-group v-model="selectedToolId">
      <v-list-item
        v-for="(toolId, index) in toolset.toolIds"
        :key="index"
        :value="toolId"
      >
        <v-list-item-avatar>
          <!-- TODO: procedural icons -->
          <v-icon>mdi-alert-circle</v-icon>
        </v-list-item-avatar>
        <v-list-item-content
          ><v-list-item-title v-text="toolId"></v-list-item-title
        ></v-list-item-content>
        <v-list-item-action
          ><v-btn icon @click="removeToolId(toolId)"
            ><v-icon>mdi-close</v-icon></v-btn
          ></v-list-item-action
        >
      </v-list-item>
    </v-list-item-group>
  </v-list>
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";

@Component({
  components: {}
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

  removeToolId(toolId: string) {
    if (toolId === this.selectedToolId) {
      this.selectedToolId = "";
    }
    this.store.removeToolIdFromCurrentToolset({ id: toolId });
  }
}
</script>
