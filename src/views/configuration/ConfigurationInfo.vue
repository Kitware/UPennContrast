<template>
  <v-container>
    <alert-dialog ref="alert" />
    <v-container class="d-flex">
      <v-spacer />
      <v-dialog v-model="removeConfirm" max-width="33vw">
        <template #activator="{ on }">
          <v-btn color="red" v-on="on" :disabled="!store.configuration">
            <v-icon left>mdi-close</v-icon>
            Delete Collection
          </v-btn>
        </template>
        <v-card>
          <v-card-title>
            Are you sure to delete "{{ name }}" forever?
          </v-card-title>
          <v-card-actions class="button-bar">
            <v-btn @click="removeConfirm = false">Cancel</v-btn>
            <v-btn @click="remove" color="warning">Remove</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
    <v-text-field :value="name" label="Name" readonly />
    <v-textarea :value="description" label="Description" readonly />
    <v-card class="mb-4">
      <v-card-title> Datasets </v-card-title>
      <v-card-text>
        <v-dialog
          v-model="removeDatasetViewConfirm"
          max-width="33vw"
          v-if="viewToRemove"
        >
          <v-card>
            <v-card-title>
              Are you sure to remove the view for dataset "{{
                datasetInfoCache[viewToRemove.datasetId]
                  ? datasetInfoCache[viewToRemove.datasetId].name
                  : "Unnamed dataset"
              }}"?
            </v-card-title>
            <v-card-actions class="button-bar">
              <v-btn @click="closeRemoveDatasetDialog()"> Cancel </v-btn>
              <v-btn @click="removeDatasetView()" color="warning">
                Remove
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
        <v-list>
          <v-list-item v-for="d in datasetViewItems" :key="d.datasetView.id">
            <v-list-item-content>
              <v-list-item-title>
                {{ d.datasetInfo ? d.datasetInfo.name : "Unnamed dataset" }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{
                  d.datasetInfo ? d.datasetInfo.description : "No description"
                }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <span class="button-bar">
                <v-btn
                  color="warning"
                  v-on:click.stop="openRemoveDatasetDialog(d.datasetView)"
                >
                  <v-icon left>mdi-close</v-icon>remove
                </v-btn>
                <v-btn color="primary" :to="toRoute(d.datasetView)">
                  <v-icon left>mdi-eye</v-icon>
                  view
                </v-btn>
              </span>
            </v-list-item-action>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-card-actions class="d-block">
        <v-divider />
        <div class="clickable-flex pa-2 body" @click="addDatasetDialog = true">
          <v-icon class="pr-2" color="primary">mdi-plus-circle</v-icon>
          Add dataset to current collection
        </div>
        <v-dialog
          content-class="smart-overflow"
          v-model="addDatasetDialog"
          width="60%"
        >
          <add-dataset-to-collection
            v-if="configuration"
            :collection="configuration"
            @addedDatasets="addedDatasets"
            @done="addDatasetDialog = false"
            @warning="openAlert({ type: 'warning', message: $event })"
            @error="openAlert({ type: 'error', message: $event })"
          />
        </v-dialog>
      </v-card-actions>
    </v-card>
    <v-card class="mb-4">
      <v-card-title> Layers </v-card-title>
      <v-card-text>
        <v-list two-line>
          <v-list-item v-for="l in layers" :key="l.name">
            <v-list-item-avatar>
              <v-icon :color="l.color">mdi-circle</v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>
                {{ l.name }}{{ !l.visible ? "(hidden)" : "" }}
              </v-list-item-title>
              <v-list-item-subtitle>
                Channel: <code class="code">{{ l.channel }}</code> Z-Slice:
                <code class="code">{{ toSlice(l.z) }}</code> Time-Slice:
                <code class="code">{{ toSlice(l.time) }}</code>
              </v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
    <v-card class="mb-4">
      <v-card-title> Scale </v-card-title>
      <v-card-text>
        <scale-settings :configuration-only="true" />
      </v-card-text>
    </v-card>
  </v-container>
</template>
<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import girderResources from "@/store/girderResources";
import { IDatasetView, IDisplaySlice } from "@/store/model";
import { IGirderFolder } from "@/girder";
import ScaleSettings from "@/components/ScaleSettings.vue";
import AddDatasetToCollection from "@/components/AddDatasetToCollection.vue";
import AlertDialog, { IAlert } from "@/components/AlertDialog.vue";

@Component({
  components: { AddDatasetToCollection, AlertDialog, ScaleSettings },
})
export default class ConfigurationInfo extends Vue {
  readonly store = store;
  readonly girderResources = girderResources;

  readonly $refs!: {
    alert: AlertDialog;
  };

  removeConfirm = false;

  removeDatasetViewConfirm = false;
  viewToRemove: IDatasetView | null = null;

  datasetViews: IDatasetView[] = [];
  datasetInfoCache: { [datasetId: string]: IGirderFolder } = {};

  addDatasetDialog: boolean = false;

  get name() {
    return store.configuration ? store.configuration.name : "";
  }

  get description() {
    return this.store.configuration ? this.store.configuration.description : "";
  }

  get layers() {
    return this.store.layers;
  }

  get configuration() {
    return this.store.configuration;
  }

  mounted() {
    this.updateConfigurationViews();
  }

  openAlert(alert: IAlert) {
    this.addDatasetDialog = false;
    this.$refs.alert.openAlert(alert);
  }

  addedDatasets() {
    this.addDatasetDialog = false;
    this.updateConfigurationViews();
  }

  @Watch("configuration")
  async updateConfigurationViews() {
    if (this.configuration) {
      this.datasetViews = await this.store.api.findDatasetViews({
        configurationId: this.configuration.id,
      });
    } else {
      this.datasetViews = [];
    }
    return this.datasetViews;
  }

  get datasetViewItems(): {
    datasetView: IDatasetView;
    datasetInfo: IGirderFolder | undefined;
  }[] {
    return this.datasetViews.map((datasetView) => ({
      datasetView,
      datasetInfo: this.datasetInfoCache[datasetView.datasetId],
    }));
  }

  @Watch("datasetViews")
  fetchDatasetsInfo() {
    for (const datasetView of this.datasetViews) {
      this.girderResources
        .getFolder(datasetView.datasetId)
        .then((folder) =>
          Vue.set(this.datasetInfoCache, datasetView.datasetId, folder),
        );
    }
  }

  toRoute(datasetView: IDatasetView) {
    return {
      name: "datasetview",
      params: Object.assign({}, this.$route.params, {
        datasetViewId: datasetView.id,
      }),
    };
  }

  openRemoveDatasetDialog(datasetView: IDatasetView) {
    this.removeDatasetViewConfirm = true;
    this.viewToRemove = datasetView;
  }

  closeRemoveDatasetDialog() {
    this.removeDatasetViewConfirm = false;
    this.viewToRemove = null;
  }

  removeDatasetView() {
    if (this.viewToRemove) {
      this.store.deleteDatasetView(this.viewToRemove).then(() => {
        this.removeDatasetViewConfirm = false;
        this.viewToRemove = null;
        this.updateConfigurationViews();
      });
    }
  }

  toSlice(slice: IDisplaySlice) {
    switch (slice.type) {
      case "constant":
        return String(slice.value);
      case "max-merge":
        return "Max Merge";
      case "offset":
        return `Offset by ${slice.value}`;
      default:
        return "Current";
    }
  }

  remove() {
    this.store.deleteConfiguration(this.store.configuration!).then(() => {
      this.removeConfirm = false;
      this.$router.back();
    });
  }
}
</script>

<style lang="scss" scoped>
.code {
  margin: 0 1em 0 0.5em;
}
</style>

<style lang="scss">
.clickable-flex {
  display: flex;
  align-items: center;
  cursor: pointer;
}
</style>
