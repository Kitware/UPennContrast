<template>
  <v-list dense>
    <v-list-item to="/">
      <v-list-item-action>
        <v-icon>mdi-exit-to-app</v-icon>
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>Home</v-list-item-title>
      </v-list-item-content>
    </v-list-item>
    <v-list-item :to="{ name: 'newdataset' }" v-if="store.isLoggedIn">
      <v-list-item-action>
        <v-icon>mdi-plus-circle</v-icon>
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>New Dataset</v-list-item-title>
      </v-list-item-content>
    </v-list-item>
    <v-list-item :to="{ name: 'importdataset' }" v-if="store.isLoggedIn">
      <v-list-item-action>
        <v-icon>mdi-plus-circle</v-icon>
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>Import Dataset</v-list-item-title>
      </v-list-item-content>
    </v-list-item>
    <v-list-item
      :to="{
        name: 'newconfiguration',
        params: { id: store.selectedDatasetId }
      }"
      v-if="store.dataset"
    >
      <v-list-item-action>
        <v-icon>mdi-plus-circle</v-icon>
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>New Configuration</v-list-item-title>
      </v-list-item-content>
    </v-list-item>

    <v-divider />
    <v-list-item>
      <v-list-item-content>
        <v-switch v-model="dark" label="Dark Theme" />
      </v-list-item-content>
    </v-list-item>
  </v-list>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";
import Persister from "../store/Persister";

@Component
export default class Menu extends Vue {
  readonly store = store;

  get dark() {
    return this.$vuetify.theme.dark;
  }

  set dark(value: boolean) {
    Persister.set("theme", value ? "dark" : "light");
    this.$vuetify.theme.dark = value;
  }
}
</script>
