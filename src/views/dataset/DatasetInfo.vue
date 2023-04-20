<template>
  <v-container flex>
    <v-row>
      <v-col cols="4">
        <v-card class="my-3">
          <v-toolbar>
            <v-toolbar-title>
              Dataset
            </v-toolbar-title>
            <v-spacer></v-spacer>
            <v-dialog v-model="removeDatasetConfirm" max-width="33vw">
              <template #activator="{ on }">
                <v-btn color="warning" v-on="on" :disabled="!store.dataset">
                  <v-icon left>mdi-close</v-icon>
                  Remove Dataset
                </v-btn>
              </template>
              <v-card>
                <v-card-title>
                  Are you sure to remove "{{ datasetName }}"?
                </v-card-title>
                <v-card-actions class="button-bar">
                  <v-btn @click="removeDatasetConfirm = false">
                    Cancel
                  </v-btn>
                  <v-btn @click="removeDataset" color="warning">Remove</v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
          </v-toolbar>
          <v-card-text>
            <v-data-table
              :headers="headers"
              :items="report"
              class="elevation-3 ma-2"
              hide-default-header
              hide-default-footer
            />
          </v-card-text>
        </v-card>
      </v-col>
      <v-col>
        <v-card class="my-3">
          <v-toolbar>
            <v-toolbar-title>Configurations</v-toolbar-title>
            <v-spacer></v-spacer>
            <v-tooltip top max-width="50vh">
              <template v-slot:activator="{ on, attrs }">
                <v-btn
                  v-on="on"
                  v-bind="attrs"
                  class="mx-1"
                  small
                  color="primary"
                  :to="{
                    name: 'importconfiguration',
                    query: { datasetId }
                  }"
                >
                  Add to existing collection…
                </v-btn>
              </template>
              Add this dataset to an existing collection to apply an existing
              configuration
            </v-tooltip>
            <v-tooltip top max-width="50vh">
              <template v-slot:activator="{ on, attrs }">
                <v-btn
                  v-on="on"
                  v-bind="attrs"
                  class="mx-1"
                  small
                  color="primary"
                  :to="{
                    name: 'duplicateimportconfiguration',
                    query: { datasetId }
                  }"
                >
                  Import configuration from collection…
                </v-btn>
              </template>
              Create a copy of a collection from an existing collection and
              apply to the current dataset. Changes to the original collection
              don't apply to the copied collection and vice-versa
            </v-tooltip>
            <v-tooltip top max-width="50vh">
              <template v-slot:activator="{ on, attrs }">
                <v-btn
                  v-on="on"
                  v-bind="attrs"
                  class="mx-1"
                  small
                  color="primary"
                  :to="{
                    name: 'newconfiguration',
                    params: {},
                    query: { datasetId: dataset ? dataset.id : '' }
                  }"
                >
                  Create New Configuration…
                </v-btn>
              </template>
              Create a new collection and add the current dataset to it
            </v-tooltip>
          </v-toolbar>
          <v-card-text>
            <v-dialog
              v-model="removeDatasetViewConfirm"
              max-width="33vw"
              v-if="viewToRemove"
            >
              <v-card>
                <v-card-title>
                  Are you sure to remove the view for configuration "{{
                    configInfo[viewToRemove.configurationId]
                      ? configInfo[viewToRemove.configurationId].name
                      : "Unnamed configuration"
                  }}"?
                </v-card-title>
                <v-card-actions class="button-bar">
                  <v-btn @click="closeRemoveConfigurationDialog()">
                    Cancel
                  </v-btn>
                  <v-btn @click="removeDatasetView()" color="warning">
                    Remove
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
            <v-list two-line>
              <v-list-item
                v-for="d in datasetViewItems"
                :key="d.datasetView.id"
                @click="$router.push(toRoute(d.datasetView))"
              >
                <v-list-item-content>
                  <v-list-item-title>
                    {{
                      d.configInfo ? d.configInfo.name : "Unnamed configuration"
                    }}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    {{
                      d.configInfo ? d.configInfo.description : "No description"
                    }}
                  </v-list-item-subtitle>
                </v-list-item-content>
                <v-list-item-action>
                  <span class="button-bar">
                    <v-btn
                      color="warning"
                      v-on:click.stop="
                        openRemoveConfigurationDialog(d.datasetView)
                      "
                    >
                      <v-icon left>mdi-close</v-icon>remove
                    </v-btn>
                    <v-btn
                      color="primary"
                      @click="duplicateView(d.datasetView)"
                    >
                      <v-icon left>mdi-content-duplicate</v-icon>
                      duplicate
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
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import { IDatasetConfiguration, IDatasetView } from "../../store/model";
import { IGirderItem } from "@/girder";

@Component
export default class DatasetInfo extends Vue {
  readonly store = store;

  removeDatasetConfirm = false;

  removeDatasetViewConfirm = false;
  viewToRemove: IDatasetView | null = null;

  datasetViews: IDatasetView[] = [];
  configInfo: { [configurationId: string]: IGirderItem } = {};

  readonly headers = [
    {
      text: "Field",
      sortable: false,
      value: "name",
      align: "right"
    },
    {
      text: "Value",
      sortable: false,
      value: "value"
    }
  ];

  get datasetViewItems(): {
    datasetView: IDatasetView;
    configInfo: IGirderItem | undefined;
  }[] {
    return this.datasetViews.map(datasetView => ({
      datasetView,
      configInfo: this.configInfo[datasetView.configurationId]
    }));
  }

  @Watch("datasetViews")
  fetchConfigurationsInfo() {
    for (const datasetView of this.datasetViews) {
      if (!(datasetView.configurationId in this.configInfo)) {
        this.store.api
          .getItem(datasetView.configurationId)
          .then(item =>
            Vue.set(this.configInfo, datasetView.configurationId, item)
          );
      }
    }
  }

  get dataset() {
    return this.store.dataset;
  }

  get datasetName() {
    return this.dataset?.name || "";
  }

  get datasetId() {
    return this.dataset?.id || "";
  }

  get report() {
    return [
      {
        name: "Dataset Name",
        value: this.datasetName
      },
      {
        name: "Dataset Description",
        value: this.dataset?.description || ""
      },
      {
        name: "Timepoints",
        value: this.dataset?.time.length || "?"
      },
      {
        name: "XY Slices",
        value: this.dataset?.xy.length || "?"
      },
      {
        name: "Z Slices",
        value: this.dataset?.z.length || "?"
      },
      {
        name: "Channels",
        value: this.dataset?.channels.length || "?"
      }
    ];
  }

  mounted() {
    if (this.dataset) {
      this.updateDatasetViews();
    }
  }

  @Watch("dataset")
  async updateDatasetViews() {
    if (this.dataset) {
      this.datasetViews = await this.store.api.findDatasetViews({
        datasetId: this.dataset.id
      });
    } else {
      this.datasetViews = [];
    }
    return this.datasetViews;
  }

  toRoute(datasetView: IDatasetView) {
    return {
      name: "datasetview",
      params: Object.assign({}, this.$route.params, {
        datasetViewId: datasetView.id
      })
    };
  }

  removeDataset() {
    this.store.deleteDataset(this.dataset!).then(() => {
      this.removeDatasetConfirm = false;
      this.$router.push({
        name: "root"
      });
    });
  }

  openRemoveConfigurationDialog(datasetView: IDatasetView) {
    this.removeDatasetViewConfirm = true;
    this.viewToRemove = datasetView;
  }

  closeRemoveConfigurationDialog() {
    this.removeDatasetViewConfirm = false;
    this.viewToRemove = null;
  }

  removeDatasetView() {
    if (this.viewToRemove) {
      this.store.deleteDatasetView(this.viewToRemove).then(() => {
        this.removeDatasetViewConfirm = false;
        this.viewToRemove = null;
        this.updateDatasetViews();
      });
    }
  }

  async duplicateView(datasetView: IDatasetView) {
    // TODO: temp choose location of the duplicated config
    if (!this.dataset) {
      return;
    }
    const baseConfig = await this.store.api.getConfiguration(
      datasetView.configurationId
    );
    const config = await store.api.duplicateConfiguration(
      baseConfig,
      this.dataset.id
    );
    await this.store.api.createDatasetView({
      datasetId: this.dataset.id,
      configurationId: config.id,
      layerContrasts: {},
      lastViewed: Date.now()
    });

    this.$router.push({
      name: "configuration",
      params: Object.assign({ configurationId: config.id }, this.$route.params)
    });
  }

  @Watch("datasetViews")
  @Watch("dataset")
  async ensureDefaultConfiguration() {
    if (this.dataset === null || this.datasetViews.length > 0) {
      return;
    }

    const defaultConfig = await store.createConfiguration({
      name: `${this.datasetName} default configuration`,
      description: "Default configuration"
    });

    if (defaultConfig === null) {
      throw new Error("Failed to create default configuration");
    }

    const defaultView = await this.store.api.createDatasetView({
      datasetId: this.dataset.id,
      configurationId: defaultConfig.id,
      layerContrasts: {},
      lastViewed: Date.now()
    });

    this.datasetViews = [defaultView];
  }
}
</script>
