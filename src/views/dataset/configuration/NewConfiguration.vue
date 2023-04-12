<template>
  <v-container>
    <v-form v-model="valid">
      <v-text-field v-model="name" label="Name" :rules="rules" />
      <v-textarea v-model="description" label="Description" />

      <div class="button-bar">
        <v-btn :disabled="!valid" color="success" class="mr-4" @click="submit">
          Create
        </v-btn>
      </div>
    </v-form>
  </v-container>
</template>
<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
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

    this.store
      .createConfiguration({
        name: this.name,
        description: this.description
      })
      .then(config => {
        if (!config) {
          return;
        }
        if (this.store.dataset) {
          this.store.api.createDatasetView({
            datasetId: this.store.dataset.id,
            configurationId: config.id,
            layerContrasts: {}
          });
        }
        this.$router.push({
          name: "configuration",
          params: Object.assign(
            {
              config: config.id
            },
            this.$route.params
          )
        });
      });
  }
}
</script>
