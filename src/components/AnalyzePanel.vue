<template>
  <v-card class="ma-1">
    <v-card-title>
      Analyze annotations
    </v-card-title>
    <v-card-text class="pa-1">
      <v-expansion-panels hover multiple>
        <property-creation />
        <property-list />
      </v-expansion-panels>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import PropertyList from "@/components/AnnotationBrowser/AnnotationProperties/PropertyList.vue";
import PropertyCreation from "@/components/AnnotationBrowser/AnnotationProperties/PropertyCreation.vue";

@Component({
  components: {
    PropertyCreation,
    PropertyList
  }
})
export default class AnalyzeAnnotations extends Vue {}
</script>
