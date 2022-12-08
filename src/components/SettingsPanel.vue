<template>
  <v-card class="ma-1">
    <v-card-title>
      Annotation Settings
    </v-card-title>
    <v-card-text class="pa-1">
      <v-expansion-panels hover multiple>
        <annotation-toggles />
      </v-expansion-panels>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import AnnotationToggles from "@/components/AnnotationBrowser/AnnotationToggles.vue";

@Component({ components: { AnnotationToggles } })
export default class AnnotationsSettings extends Vue {}
</script>
