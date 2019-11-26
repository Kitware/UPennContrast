<template>
  <v-container>
    <v-text-field :value="name" label="Name" readonly />
    <v-textarea :value="description" label="Description" readonly />
    <v-subheader>
      <span class="grow">Configurations</span>
      <v-btn :to="{ name: 'newconfiguration', params: $route.params }">Add Configuration</v-btn>
    </v-subheader>
    <v-list two-line>
      <v-list-item v-for="c in configurations" :key="c.name">
        <v-list-item-content>
          <v-list-item-title>{{ c.name }}</v-list-item-title>
          <v-list-item-subtitle>{{ c.description }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-btn
            icon
            :to="{
              name: 'configuration',
              params: Object.assign({ config: c.id }, $route.params)
            }"
          >
            <v-icon>mdi-eye</v-icon>
          </v-btn>
        </v-list-item-action>
      </v-list-item>
    </v-list>
  </v-container>
</template>
<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";

@Component
export default class DatasetInfo extends Vue {
  readonly store = store;

  get name() {
    return this.store.dataset ? this.store.dataset.name : "";
  }

  get description() {
    return this.store.dataset ? this.store.dataset.description : "";
  }

  get configurations() {
    return this.store.dataset ? this.store.dataset.configurations : [];
  }
}
</script>
