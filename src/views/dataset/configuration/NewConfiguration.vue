<template>
  <v-form>
    <v-text-field v-model="name" label="Name" />
    <v-textarea v-model="description" label="Description" />
  </v-form>
</template>
<script lang="ts">
import { Vue, Component, Inject, Prop } from "vue-property-decorator";
import store from "@/store";

@Component
export default class NewConfiguration extends Vue {
  readonly store = store;

  name = "";
  description = "";
}
</script>
