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
            <v-btn
              color="primary"
              :to="{
                name: 'importconfiguration',
                params: Object.assign({ id: '' }, $route.params)
              }"
            >
              Import Configuration
            </v-btn>
            <v-btn
              class="mx-2"
              color="primary"
              :to="{
                name: 'newconfiguration',
                params: Object.assign({ id: '' }, $route.params)
              }"
            >
              Create Configuration
            </v-btn>
          </v-toolbar>
          <v-card-text>
            <v-dialog
              v-model="removeConfigurationConfirm"
              max-width="33vw"
              v-if="configurationToRemove"
            >
              <v-card>
                <v-card-title>
                  Are you sure to remove "{{ configurationToRemove.name }}"?
                </v-card-title>
                <v-card-actions class="button-bar">
                  <v-btn @click="closeRemoveConfigurationDialog()">
                    Cancel
                  </v-btn>
                  <v-btn @click="removeConfiguration()" color="warning">
                    Remove
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
            <v-list two-line>
              <v-list-item
                v-for="c in configurations"
                :key="c.name"
                @click="$router.push(toRoute(c))"
              >
                <v-list-item-content>
                  <v-list-item-title>{{ c.name }}</v-list-item-title>
                  <v-list-item-subtitle>{{
                    c.description
                  }}</v-list-item-subtitle>
                </v-list-item-content>
                <v-list-item-action>
                  <span class="button-bar">
                    <v-btn
                      color="warning"
                      v-on:click.stop="openRemoveConfigurationDialog(c)"
                    >
                      <v-icon left>mdi-close</v-icon>remove
                    </v-btn>
                    <v-btn color="primary" @click="duplicateConfiguration(c)">
                      <v-icon left>mdi-content-duplicate</v-icon>
                      duplicate
                    </v-btn>
                    <v-btn color="primary" :to="toRoute(c)">
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
import { IDatasetConfiguration } from "../../store/model";

@Component
export default class DatasetInfo extends Vue {
  readonly store = store;

  removeDatasetConfirm = false;

  removeConfigurationConfirm = false;
  configurationToRemove: IDatasetConfiguration | null = null;

  configurations: IDatasetConfiguration[] = [];

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

  get dataset() {
    return this.store.dataset;
  }

  get datasetName() {
    return this.dataset?.name || "";
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
      this.updateConfigurations();
    }
  }

  @Watch("dataset")
  async updateConfigurations() {
    if (!this.dataset) {
      this.configurations = [];
    } else {
      const views = await this.store.api.findDatasetViews({
        datasetId: this.dataset.id
      });
      const configurationsSettled = await Promise.allSettled(
        views.map(view => this.store.api.getConfiguration(view.configurationId))
      );
      const configurations = configurationsSettled.reduce(
        (configurations, promise) => {
          if (promise.status === "fulfilled") {
            configurations.push(promise.value);
          }
          return configurations;
        },
        [] as IDatasetConfiguration[]
      );
      this.configurations = configurations;
    }

    return this.configurations;
  }

  toRoute(c: IDatasetConfiguration) {
    return {
      name: "view",
      params: Object.assign({}, this.$route.params, { config: c.id })
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

  openRemoveConfigurationDialog(configuration: IDatasetConfiguration) {
    this.removeConfigurationConfirm = true;
    this.configurationToRemove = configuration;
  }

  closeRemoveConfigurationDialog() {
    this.removeConfigurationConfirm = false;
    this.configurationToRemove = null;
  }

  removeConfiguration() {
    if (this.configurationToRemove) {
      this.store.deleteConfiguration(this.configurationToRemove).then(() => {
        this.removeConfigurationConfirm = false;
        this.configurationToRemove = null;
        this.updateConfigurations();
      });
    }
  }

  async duplicateConfiguration(c: IDatasetConfiguration) {
    // TODO: temp choose location of the duplicated config
    if (!this.dataset) {
      return;
    }
    const config = await store.api.duplicateConfiguration(c, this.dataset.id);

    this.$router.push({
      name: "configuration",
      params: Object.assign({ config: config.id }, this.$route.params)
    });
  }

  @Watch("configurations")
  async ensureDefaultConfiguration() {
    if (this.dataset === null || this.configurations.length > 0) {
      return;
    }

    const defaultConfig = await store.createConfiguration({
      name: `${this.datasetName} default configuration`,
      description: "Default configuration"
    });

    if (defaultConfig === null) {
      throw new Error("Configuration not set");
    }

    await this.store.api.createDatasetView({
      datasetId: this.dataset.id,
      configurationId: defaultConfig.id,
      layerContrasts: {}
    });

    this.configurations = [defaultConfig];
  }
}
</script>
