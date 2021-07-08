<template>
  <v-list v-if="toolset && toolset.toolIds" dense>
    <v-list-item-group v-model="selectedToolId">
      <v-list-item v-for="(toolId, index) in toolset.toolIds" :key="index">
        <v-list-item-icon>
          <!-- TODO: procedural icons -->
          <v-icon>mdi-alert-circle</v-icon>
          <v-list-item-content>
            <v-list-item-content v-text="toolId"></v-list-item-content>
          </v-list-item-content>
        </v-list-item-icon>
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
    return this.store.selectedToolId;
  }

  set selectedToolId(value) {
    this.store.setSelectedToolId(value);
  }

  get toolset() {
    return this.store.configuration?.toolset;
  }

  get tools() {
    return this.store.tools;
  }
}
</script>
