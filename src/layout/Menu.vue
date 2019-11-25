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
    <v-list-item :to="{ name: 'newdataset' }">
      <v-list-item-action>
        <v-icon>mdi-plus-circle</v-icon>
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>New Dataset</v-list-item-title>
      </v-list-item-content>
    </v-list-item>
    <v-list-item :to="{ name: 'newconfiguration' }" v-if="store.dataset">
      <v-list-item-action>
        <v-icon>mdi-plus-circle</v-icon>
      </v-list-item-action>
      <v-list-item-content>
        <v-list-item-title>New Configuration</v-list-item-title>
      </v-list-item-content>
    </v-list-item>
  </v-list>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";
@Component
export default class Menu extends Vue {
  readonly store = store;
}
</script>
