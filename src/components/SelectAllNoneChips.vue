<template>
  <div class="d-flex flex-column">
    <v-chip class="mb-2" outlined small @click="$emit('selectAll')">
      <v-icon left small>mdi-check-all</v-icon>
      Select All
    </v-chip>
    <v-chip outlined small @click="$emit('selectNone')">
      <v-icon left small>mdi-close-circle-outline</v-icon>
      Select None
    </v-chip>
  </div>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";

@Component
export default class SelectAllNoneChips extends Vue {}
</script>
