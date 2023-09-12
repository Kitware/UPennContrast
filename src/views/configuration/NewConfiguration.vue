<template>
  <v-container>
    <div class="headline py-4">
      Create a new collection from a dataset
    </div>
    <v-form v-model="valid">
      <v-text-field v-model="name" label="Name" :rules="rules" />
      <v-textarea v-model="description" label="Description" />
      <girder-location-chooser
        v-model="path"
        :breadcrumb="true"
        title="Select a Folder to Create the New Configuration"
      />

      <div class="button-bar">
        <v-btn :disabled="!valid" color="success" class="mr-4" @click="submit">
          Create
        </v-btn>
      </div>
    </v-form>
  </v-container>
</template>
<script lang="ts">
import { Component, Watch } from "vue-property-decorator";
import store from "@/store";
import girderResources from "@/store/girderResources";
import routeMapper from "@/utils/routeMapper";
import { IGirderSelectAble } from "@/girder";
import GirderLocationChooser from "@/components/GirderLocationChooser.vue";

const Mapper = routeMapper(
  {},
  {
    datasetId: {
      parse: String,
      get: () => store.selectedDatasetId,
      set: (value: string) => store.setSelectedDataset(value)
    }
  }
);

@Component({ components: { GirderLocationChooser } })
export default class NewConfiguration extends Mapper {
  readonly store = store;
  readonly girderResources = girderResources;

  valid = false;
  name = "";
  description = "";
  path: IGirderSelectAble | null = null;

  get dataset() {
    return this.store.dataset;
  }

  mounted() {
    this.fetchDefaultPath();
  }

  @Watch("dataset")
  async fetchDefaultPath() {
    const datasetId = this.store.dataset?.id;
    if (datasetId) {
      const datasetFolder = await this.girderResources.getFolder(datasetId);
      const parentId = datasetFolder?.parentId;
      if (parentId) {
        const parentFolder = await this.girderResources.getFolder(parentId);
        this.path = parentFolder;
        return;
      }
    }
    this.path = this.store.girderUser;
  }

  get rules() {
    return [(v: string) => v.trim().length > 0 || `value is required`];
  }

  submit() {
    const folderId = this.path?._id;
    if (!this.valid || !folderId) {
      return;
    }

    this.store
      .createConfiguration({
        name: this.name,
        description: this.description,
        folderId
      })
      .then(config => {
        if (!config) {
          return;
        }
        if (this.store.dataset) {
          this.store.createDatasetView({
            configurationId: config.id,
            datasetId: this.store.dataset.id
          });
        }
        this.$router.push({
          name: "configuration",
          params: Object.assign(
            {
              configurationId: config.id
            },
            this.$route.params
          )
        });
      });
  }
}
</script>
