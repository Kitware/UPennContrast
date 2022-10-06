<template>
  <v-list dense>
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
