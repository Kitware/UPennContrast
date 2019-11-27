<template>
  <v-container>
    <div>{{ name }}</div>
  </v-container>
</template>
<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";

@Component
export default class ConfigurationInfo extends Vue {
  readonly store = store;

  get name() {
    return store.configuration ? store.configuration.name : "";
  }
}
</script>
