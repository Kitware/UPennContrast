<template>
  <v-container>
    <v-progress-circular v-if="loading" indeterminate />
    <v-list v-else-if="compatibleConfigurations.length > 0">
      <v-list-item-group multiple v-model="selectedConfigurations">
        <v-list-item
          v-for="configuration in compatibleConfigurations"
          :key="configuration.id"
        >
          <v-list-item-content>
            {{ configuration.name }} {{ configuration.description }}
          </v-list-item-content>
        </v-list-item>
      </v-list-item-group>
    </v-list>
    <v-alert v-else color="orange darken-2" dark>
      No compatible configurations were found for this dataset.
    </v-alert>
    <div class="button-bar">
      <v-btn color="warning" class="mr-4" @click="cancel">Cancel</v-btn>
      <v-btn
        :disabled="selectedConfigurations.length <= 0"
        color="primary"
        class="mr-4"
        @click="submit"
      >
        Import
      </v-btn>
    </div>
  </v-container>
</template>
<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import { IDatasetConfiguration } from "@/store/model";

@Component
export default class ImportConfiguration extends Vue {
  readonly store = store;

  compatibleConfigurations: IDatasetConfiguration[] = [];
  selectedConfigurations: number[] = [];
  loading: boolean = false;

  get dataset() {
    return this.store.dataset;
  }

  @Watch("dataset")
  watchDataset() {
    this.updateCompatibleConfigurations();
  }

  async updateCompatibleConfigurations() {
    if (!this.dataset) {
      this.compatibleConfigurations = [];
      return;
    }
    this.loading = true;
    try {
      const views = await this.store.api.findDatasetViews({
        datasetId: this.dataset.id
      });
      const linkedConfigurationIds = new Set(views.map(v => v.configurationId));
      const compatibleConfigurations = await this.store.api.getCompatibleConfigurations(
        this.dataset
      );
      this.compatibleConfigurations = compatibleConfigurations.filter(
        conf => !linkedConfigurationIds.has(conf.id)
      );
    } finally {
      this.loading = false;
    }
  }

  mounted() {
    this.updateCompatibleConfigurations();
  }

  async submit() {
    // TODO: temp choose where to import configuration
    if (!this.dataset) {
      return;
    }

    // Create a view for each configuration
    const promises: Promise<any>[] = [];
    for (const configurationIdx of this.selectedConfigurations) {
      const configuration = this.compatibleConfigurations[configurationIdx];
      promises.push(
        this.store.api.createDatasetView({
          configurationId: configuration.id,
          datasetId: this.dataset.id,
          layerContrasts: {},
          lastViewed: Date.now()
        })
      );
    }

    this.$router.back();
  }

  async cancel() {
    this.$router.back();
  }
}
</script>
