<template>
  <v-container>
    <div class="headline py-4">
      Copy one or several existing collections to add to dataset
      {{ datasetName }}
    </div>
    <v-card>
      <v-card-title>
        Location of new collections
      </v-card-title>
      <v-card-text>
        <div class="d-flex">
          <girder-location-chooser
            v-model="path"
            :breadcrumb="true"
            title="Select a Folder to Import the New Dataset"
          />
        </div>
      </v-card-text>
    </v-card>
    <configuration-select
      @submit="submit"
      @cancel="cancel"
      :title="'Compatible collections'"
    />
  </v-container>
</template>
<script lang="ts">
import { IDatasetConfiguration } from "@/store/model";
import { IGirderSelectAble } from "@/girder";
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import girderResources from "@/store/girderResources";
import ConfigurationSelect from "@/components/ConfigurationSelect.vue";
import GirderLocationChooser from "@/components/GirderLocationChooser.vue";

@Component({
  components: {
    ConfigurationSelect,
    GirderLocationChooser
  }
})
export default class DuplicateImportConfiguration extends Vue {
  readonly store = store;
  readonly girderResources = girderResources;

  path: IGirderSelectAble | null = null;

  get dataset() {
    return this.store.dataset;
  }

  get datasetName() {
    return this.dataset?.name || "";
  }

  @Watch("dataset")
  async fetchParentFolder() {
    this.path = null;
    if (!this.dataset) {
      return;
    }
    const datasetFolder = await this.girderResources.getFolder(this.dataset.id);
    const parentId = datasetFolder?.parentId;
    if (!parentId) {
      return;
    }
    this.path = await this.girderResources.getFolder(parentId);
  }

  mounted() {
    this.fetchParentFolder();
  }

  async submit(configurations: IDatasetConfiguration[]) {
    const dataset = this.dataset;
    const parentFolder = this.path;
    if (!dataset || !parentFolder) {
      return;
    }

    // Duplicate each configuration and create a view for it
    await Promise.all(
      configurations.map(configuration =>
        this.store.api
          .duplicateConfiguration(configuration, parentFolder?._id)
          .then(newConfiguration =>
            this.store.createDatasetView({
              configurationId: newConfiguration.id,
              datasetId: dataset.id
            })
          )
      )
    );

    this.$router.back();
  }

  cancel() {
    this.$router.back();
  }
}
</script>
