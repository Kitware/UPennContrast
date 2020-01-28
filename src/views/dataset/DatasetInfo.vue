<template>
  <v-container>
    <v-text-field :value="name" label="Name" readonly />
    <v-textarea :value="description" label="Description" readonly />
    <v-text-field :value="time" label="# Timepoints" readonly />
    <v-text-field :value="xy" label="# XY-Slices" readonly />
    <v-text-field :value="z" label="# Z-Slices" readonly />
    <v-text-field :value="channels" label="# Channels" readonly />
    <v-subheader>
      <span class="grow">Configurations</span>
      <v-btn
        color="primary"
        :to="{
          name: 'newconfiguration',
          params: Object.assign({ id: '' }, $route.params)
        }"
        >Add Configuration</v-btn
      >
    </v-subheader>
    <v-list two-line>
      <v-list-item
        v-for="c in configurations"
        :key="c.name"
        @click="$router.push(toRoute(c))"
      >
        <v-list-item-content>
          <v-list-item-title>{{ c.name }}</v-list-item-title>
          <v-list-item-subtitle>{{ c.description }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-btn icon :to="toRoute(c)">
            <v-icon>mdi-eye</v-icon>
          </v-btn>
        </v-list-item-action>
      </v-list-item>
    </v-list>
    <div class="button-bar">
      <v-dialog v-model="removeConfirm" max-width="33vw">
        <template #activator="{ on }">
          <v-btn color="warning" v-on="on" :disabled="!store.dataset">
            <v-icon left>mdi-close</v-icon>
            Remove
          </v-btn>
        </template>
        <v-card>
          <v-card-title>Are you sure to remove "{{ name }}"?</v-card-title>
          <v-card-actions class="button-bar">
            <v-btn @click="removeConfirm = false">Cancel</v-btn>
            <v-btn @click="remove" color="warning">Remove</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
      <v-btn
        color="primary"
        :to="configurations.length > 0 ? toRoute(configurations[0]) : undefined"
        :disabled="configurations.length === 0"
      >
        <v-icon left>mdi-eye</v-icon>
        View
      </v-btn>
    </div>
  </v-container>
</template>
<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";
import { IDatasetConfiguration } from "../../store/model";

@Component
export default class DatasetInfo extends Vue {
  readonly store = store;

  removeConfirm = false;

  get name() {
    return this.store.dataset ? this.store.dataset.name : "";
  }

  get description() {
    return this.store.dataset ? this.store.dataset.description : "";
  }

  get xy() {
    return this.store.dataset ? this.store.dataset.xy.length : "?";
  }

  get z() {
    return this.store.dataset ? this.store.dataset.z.length : "?";
  }

  get time() {
    return this.store.dataset ? this.store.dataset.time.length : "?";
  }

  get channels() {
    return this.store.dataset ? this.store.dataset.channels.length : "?";
  }

  get configurations() {
    return this.store.dataset ? this.store.dataset.configurations : [];
  }

  toRoute(c: IDatasetConfiguration) {
    return {
      name: "view",
      params: Object.assign({ config: c.id }, this.$route.params)
    };
  }

  remove() {
    this.store.deleteDataset(this.store.dataset!).then(() => {
      this.removeConfirm = false;
      this.$router.push({
        name: "root"
      });
    });
  }
}
</script>
