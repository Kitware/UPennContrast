<template>
  <v-container>
    <v-form v-model="valid">
      <v-text-field v-model="name" label="Name" :rules="rules" />
      <v-textarea v-model="description" label="Description" />

      <v-btn :disabled="!valid" color="success" class="mr-4" @click="submit">
        Create
      </v-btn>
    </v-form>
  </v-container>
</template>
<script lang="ts">
import { Vue, Component, Inject, Prop } from "vue-property-decorator";
import store from "@/store";

@Component
export default class NewConfiguration extends Vue {
  readonly store = store;

  valid = false;
  name = "";
  description = "";

  get rules() {
    return [(v: string) => v.trim().length > 0 || `value is required`];
  }

  submit() {
    if (!this.valid) {
      return;
    }

    // TODO create dataset for real
  }
}
</script>
