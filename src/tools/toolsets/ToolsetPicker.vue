<template>
  <v-card>
    <v-card-text>
      <v-text-field
        v-model="query"
        prepend-icon="mdi-magnify"
        clearable
        clear-icon="mdi-close"
      ></v-text-field>
      <template v-if="queriedTools && queriedTools.length">
        <v-list>
          <v-list-item-group v-model="selectedTools" multiple>
            <template v-for="tool in queriedTools">
              <v-list-item :value="tool.id" :key="tool.id">
                <v-list-item-icon>
                  <tool-icon :tool="tool"></tool-icon>
                </v-list-item-icon>
                <v-list-item-content>
                  <v-list-item-title>{{ tool.name }}</v-list-item-title>
                  <v-list-item-subtitle v-if="tool.description.length">{{
                    tool.description
                  }}</v-list-item-subtitle>
                </v-list-item-content>
              </v-list-item>
            </template>
          </v-list-item-group>
        </v-list>
      </template>
      <v-subheader v-else>
        No tools found.
      </v-subheader>
    </v-card-text>

    <v-card-actions>
      <div class="button-bar">
        <v-btn color="primary" :enabled="selectedTools.length" @click="confirm">
          CONFIRM
        </v-btn>
      </div>
    </v-card-actions>
  </v-card>
</template>
<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";
import ToolIcon from "@/tools/ToolIcon.vue";
import { IToolConfiguration } from "@/store/model";

// Interface for adding tools to the current toolset
@Component({
  components: { ToolIcon }
})
export default class ToolsetPicker extends Vue {
  readonly store = store;

  selectedTools: string[] = [];

  get toolsetIds() {
    if (this.store.configuration?.toolset) {
      return this.store.configuration?.toolset.toolIds;
    }
    return [];
  }
  get tools() {
    return this.store.tools.filter(({ id }) => !this.toolsetIds.includes(id));
  }

  get queriedTools() {
    if (!this.query?.length) {
      return this.tools;
    }

    const query = this.query.toLowerCase();

    const matchesQuery = (tool: IToolConfiguration, query: string) =>
      tool.name.toLowerCase().indexOf(query) > -1 ||
      tool.description.toLowerCase().indexOf(query) > -1;

    return this.tools.filter(tool => matchesQuery(tool, query));
  }

  query: string = "";

  confirm() {
    if (this.selectedTools.length) {
      this.store.addToolIdsToCurrentToolset({ ids: this.selectedTools });
      this.store.syncConfiguration();
      this.selectedTools = [];
      this.$emit("done");
    }
  }

  mounted() {
    this.store.fetchAvailableTools();
  }
}
</script>
