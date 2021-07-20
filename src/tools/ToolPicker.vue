<template>
  <v-card>
    <v-card-text>
      <v-list>
        <v-list-item-group v-model="selectedTools" multiple>
          <v-list-item v-for="tool in tools" :key="tool.id">
            <v-list-item-title>{{ tool.name }}</v-list-item-title>
          </v-list-item>
        </v-list-item-group>
      </v-list>
    </v-card-text>

    <div class="button-bar">
      <v-btn color="primary" :enabled="selectedTools.length" @click="confirm">
        CONFIRM
      </v-btn>
    </div>
  </v-card>
</template>
<script lang="ts">
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
// Manually import those vuetify components that might be used procedurally
import { VSelect, VCheckbox, VTextField, VRadioGroup } from "vuetify/lib";
import AnnotationConfiguration from "@/tools/AnnotationConfiguration.vue";
import TagAndChannelRestriction from "@/tools/TagAndChannelRestriction.vue";

// TODO: don't show tools that already are in the toolset
// TODO: two columns, user tools / all other accessible tools ? (need to track creator name)
// TODO: search bars
// TODO: cancel button
// TODO: rename to toolsetpicker

@Component({
  components: {}
})
export default class ToolConfiguration extends Vue {
  readonly store = store;

  selectedTools: string[] = [];

  get toolsetIds() {
    if (this.store.configuration?.toolset) {
      return this.store.configuration?.toolset.toolIds;
    }
    return [];
  }
  get tools() {
    return this.store.tools.filter(id => !this.toolsetIds.includes(id));
  }

  confirm() {
    if (this.selectedTools.length) {
      this.store.addToolIdsToCurrentToolset({
        ids: this.selectedTools.map(idx => this.tools[idx].id)
      });
      this.selectedTools = [];
      this.$emit("done");
    }
  }

  mounted() {
    // TODO: this should be called when bringing up the toolset interface
    // TODO: async
    this.store.fetchAvailableTools();
  }
}
</script>
