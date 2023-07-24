<template>
  <v-card class="ma-1">
    <v-card-title>
      NimbusImage settings
    </v-card-title>
    <v-card-text class="pa-1">
      <v-expansion-panels hover multiple v-model="panels">
        <annotation-toggles />
        <viewer-settings />
        <ui-settings />
      </v-expansion-panels>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import AnnotationToggles from "@/components/AnnotationBrowser/AnnotationToggles.vue";
import ViewerSettings from "@/components/ViewerSettings.vue";
import UiSettings from "@/components/UISettings.vue";

@Component({
  components: {
    AnnotationToggles,
    ViewerSettings,
    UiSettings
  }
})
export default class AnnotationsSettings extends Vue {
  panels: number[] = [0, 1, 2];
}
</script>
