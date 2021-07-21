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
import { Vue, Component, Watch, Prop } from "vue-property-decorator";
import store from "@/store";
// Manually import those vuetify components that might be used procedurally
import { VSelect, VCheckbox, VTextField, VRadioGroup } from "vuetify/lib";
import AnnotationConfiguration from "@/tools/AnnotationConfiguration.vue";
import TagAndChannelRestriction from "@/tools/TagAndChannelRestriction.vue";

// TODO: two columns, user tools / all other accessible tools ? (need to track creator name)
// TODO: search bars
// TODO: cancel button

@Component({
  components: {}
})
export default class ToolsetPicker extends Vue {
  readonly store = store;

  selectedTools: number[] = [];

  get toolsetIds() {
    if (this.store.configuration?.toolset) {
      return this.store.configuration?.toolset.toolIds;
    }
    return [];
  }
  get tools() {
    return this.store.tools.filter(({id}) => !this.toolsetIds.includes(id));
  }

  confirm() {
    console.log(this.selectedTools);
    if (this.selectedTools.length) {
      this.store.addToolIdsToCurrentToolset({
        ids: this.selectedTools.map(idx => this.tools[idx].id)
      });
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
