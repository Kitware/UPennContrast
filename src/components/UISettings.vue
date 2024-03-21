<template>
  <v-expansion-panel>
    <v-expansion-panel-header> Interface settings </v-expansion-panel-header>
    <v-expansion-panel-content>
      <v-container>
        <v-switch
          hide-details
          dense
          v-model="darkMode"
          label="Dark mode"
          v-description="{
            section: 'Interface settings',
            title: 'Dark mode',
            description: 'Enable dark mode',
          }"
        />
      </v-container>
    </v-expansion-panel-content>
  </v-expansion-panel>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store/index";

@Component
export default class UISettings extends Vue {
  readonly store = store;

  get darkMode() {
    return this.$vuetify.theme.dark;
  }

  set darkMode(value) {
    this.$vuetify.theme.dark = value;
  }
}
</script>
