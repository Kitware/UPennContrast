<template>
  <v-container>
    <v-progress-circular v-if="loading" indeterminate />
    <v-treeview
      v-else-if="compatibleDatasets.length > 0"
      :items="tree"
      activatable
      item-key="key"
      :active.sync="active"
      return-object
      hoverable
      open-on-click
    >
    </v-treeview>
    <v-alert v-else border="top" color="orange darken-2" dark>
      No compatible configurations were found for this dataset.
    </v-alert>
    <div class="button-bar">
      <v-btn color="warning" class="mr-4" @click="cancel">Back</v-btn>
      <v-btn
        :disabled="active.length === 0"
        color="primary"
        class="mr-4"
        @click="submit"
        >Import</v-btn
      >
    </div>
  </v-container>
</template>
<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import { IDataset, IViewConfiguration } from "@/store/model";

@Component
export default class ImportConfiguration extends Vue {
  readonly store = store;

  name = "";
  description = "";
  compatibleDatasets: IDataset[] = [];
  active: any = [];
  loading: boolean = false;

  get dataset() {
    return this.store.dataset;
  }

  @Watch("dataset")
  watchDataset() {
    this.updateCompatibleDatasets();
  }

  // Need to build a tree with datasets as roots and configurations as leaves
  // for the v-treeview
  get tree() {
    return this.compatibleDatasets.map(dataset => ({
      name: dataset.name,
      key: dataset.id,
      children: dataset.configurations.map(configuration => ({
        name: configuration.name,
        key: configuration.id,
        children: [],
        meta: configuration,
        parent: dataset
      }))
    }));
  }

  updateCompatibleDatasets() {
    if (!this.dataset) {
      this.compatibleDatasets = [];
      return;
    }

    this.loading = true;
    const end = () => (this.loading = false);

    const numberOfChannels = this.dataset.channels.length;

    store.api
      .getAllPublicDatasets()
      .then(datasetItems => {
        return Promise.all(
          datasetItems.map(dataset =>
            store.api.getDataset(dataset.id, false, false, false)
          )
        )
          .then(datasets => {
            this.compatibleDatasets = datasets.filter(dataset =>
              dataset ? dataset.channels.length === numberOfChannels : false
            );
            end();
          })
          .catch(end);
      })
      .catch(end);
  }

  mounted() {
    this.updateCompatibleDatasets();
  }

  async submit() {
    const [active] = this.active;
    const configToCopy = active.meta;
    const config = await this.store.createConfiguration({
      name: configToCopy.name,
      description: configToCopy.description
    });
    if (!config) {
      return;
    }

    const view: IViewConfiguration = { layers: configToCopy.view.layers };
    config.view = view;

    await store.api.updateConfiguration(config);

    this.$router.push({
      name: "configuration",
      params: Object.assign({ config: config.id }, this.$route.params)
    });
  }

  async cancel() {
    this.$router.back();
  }
}
</script>
