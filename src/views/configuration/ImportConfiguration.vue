<template>
  <v-container>
    <configuration-select
      @submit="submit"
      @cancel="cancel"
      :title="`Add dataset ${datasetName} to one or several existing collections`"
    />
  </v-container>
</template>
<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";
import ConfigurationSelect from "@/components/ConfigurationSelect.vue";
import { IDatasetConfiguration } from "@/store/model";

@Component({
  components: { ConfigurationSelect },
})
export default class ImportConfiguration extends Vue {
  readonly store = store;

  get datasetName() {
    return this.store.dataset?.name || "";
  }

  async submit(configurations: IDatasetConfiguration[]) {
    const dataset = this.store.dataset;
    if (!dataset) {
      return;
    }

    // Create a view for each configuration
    await Promise.all(
      configurations.map((configuration) =>
        this.store.createDatasetView({
          configurationId: configuration.id,
          datasetId: dataset.id,
        }),
      ),
    );

    this.$router.back();
  }

  cancel() {
    this.$router.back();
  }
}
</script>
