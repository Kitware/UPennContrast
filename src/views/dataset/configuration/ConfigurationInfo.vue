<template>
  <v-container>
    <v-text-field :value="name" label="Name" readonly />
    <v-textarea :value="description" label="Description" readonly />
    <v-subheader>
      Layers
    </v-subheader>
    <v-list two-line>
      <v-list-item v-for="l in layers" :key="l.name">
        <v-list-item-avatar>
          <v-icon :color="l.color">mdi-square</v-icon>
        </v-list-item-avatar>
        <v-list-item-content>
          <v-list-item-title>{{ l.name }}</v-list-item-title>
          <v-list-item-subtitle>TODO</v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>
    </v-list>
    <div class="toolbar">
      <v-dialog v-model="removeConfirm" max-width="33vw">
        <template #activator="{ on }">
          <v-btn color="warning" v-on="on" :disabled="!store.configuration">
            <v-icon left>mdi-close</v-icon>
            Remove
          </v-btn>
        </template>
        <v-card>
          <v-card-title>Are you sure to remove "{{ name }}"?</v-card-title>
          <v-card-actions class="toolbar">
            <v-btn @click="removeConfirm = false">Cancel</v-btn>
            <v-btn @click="remove" color="warning">Remove</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
      <v-btn color="primary" :to="view" :disabled="!store.configuration">
        <v-icon left>mdi-eye</v-icon>
        View
      </v-btn>
    </div>
  </v-container>
</template>
<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";

@Component
export default class ConfigurationInfo extends Vue {
  readonly store = store;

  removeConfirm = false;

  get name() {
    return store.configuration ? store.configuration.name : "";
  }

  get description() {
    return this.store.configuration ? this.store.configuration.description : "";
  }

  get layers() {
    if (!this.store.configuration) {
      return [];
    }
    return this.store.configuration.layers;
  }

  get view() {
    return {
      name: "view",
      params: Object.assign(
        { config: this.store.selectedConfigurationId! },
        this.$route.params
      )
    };
  }

  remove() {
    this.store.deleteConfiguration(this.store.configuration!).then(() => {
      this.removeConfirm = false;
      this.$router.push({
        name: "dataset",
        params: {
          id: this.$route.params.id
        }
      });
    });
  }
}
</script>
<style lang="scss" scoped>
.toolbar {
  display: flex;
  justify-content: flex-end;
  margin-top: 1em;

  > * {
    margin-left: 1em;
  }
}
</style>
