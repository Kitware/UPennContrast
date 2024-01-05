<template>
  <v-container class="ma-0 pa-0">
    <v-row class="mr-4">
      <v-col class="px-0 d-flex justify-center" cols="1">
        <div class="subtitle-2 d-flex">In list</div>
      </v-col>
      <v-col class="px-0 d-flex justify-center" cols="1">
        <div class="subtitle-2 d-flex">As filter</div>
      </v-col>
      <v-col class="px-0 d-flex justify-center">
        <div class="subtitle-2 d-flex">Property</div>
      </v-col>
      <v-col class="px-0 d-flex justify-center" cols="1">
        <div class="subtitle-2 d-flex">Compute</div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";

@Component({})
export default class AnnotationPropertyHeader extends Vue {}
</script>
