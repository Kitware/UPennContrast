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
                <v-card-title
                  >Are you sure to remove "{{ name }}"?</v-card-title
                >
                <v-card-actions class="button-bar">
                  <v-btn @click="removeDatasetConfirm = false">Cancel</v-btn>
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
              >Add Configuration</v-btn
            >
          </v-toolbar>
          <v-card-text>
            <v-dialog
              v-model="removeConfigurationConfirm"
              max-width="33vw"
              v-if="configurationToRemove"
            >
              <v-card>
                <v-card-title
                  >Are you sure to remove "{{
                    configurationToRemove.name
                  }}"?</v-card-title
                >
                <v-card-actions class="button-bar">
                  <v-btn @click="removeDatasetConfirm = false">Cancel</v-btn>
                  <v-btn
                    @click="removeConfiguration(configurationToRemove)"
                    color="warning"
                    >Remove</v-btn
                  >
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
                      ><v-icon left>mdi-close</v-icon>remove</v-btn
                    >
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
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";
import {
  IDatasetConfiguration,
  IDisplayLayer,
  newLayer
} from "../../store/model";
import { formatDate } from "@/utils/date";

@Component
export default class DatasetInfo extends Vue {
  readonly store = store;

  removeDatasetConfirm = false;

  removeConfigurationConfirm = false;
  configurationToRemove: IDatasetConfiguration | null = null;

  configuration: IDatasetConfiguration[] = [];

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

  get name() {
    return this.store.dataset ? this.store.dataset.name : "";
  }

  get description() {
    return this.store.dataset ? this.store.dataset.description : "";
  }

  get xy() {
    return this.store.dataset ? this.store.dataset.xy.length : "?";
  }

  get z() {
    return this.store.dataset ? this.store.dataset.z.length : "?";
  }

  get time() {
    return this.store.dataset ? this.store.dataset.time.length : "?";
  }

  get channels() {
    return this.store.dataset ? this.store.dataset.channels.length : "?";
  }

  get report() {
    const { name, description, time, xy, z, channels } = this;

    return [
      {
        name: "Dataset Name",
        value: name
      },
      {
        name: "Dataset Description",
        value: description
      },
      {
        name: "Timepoints",
        value: time
      },
      {
        name: "XY Slices",
        value: xy
      },
      {
        name: "Z Slices",
        value: z
      },
      {
        name: "Channels",
        value: channels
      }
    ];
  }

  get configurations() {
    const existing = this.store.dataset
      ? this.store.dataset.configurations
      : [];
    const my = this.configuration;

    return existing.length === 0 ? existing.concat(my) : existing;
  }

  updated() {
    this.ensureDefaultConfiguration();
  }

  toRoute(c: IDatasetConfiguration) {
    return {
      name: "view",
      params: Object.assign({}, this.$route.params, { config: c.id })
    };
  }

  removeDataset() {
    this.store.deleteDataset(this.store.dataset!).then(() => {
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

  removeConfiguration(c: IDatasetConfiguration) {
    this.store.deleteConfiguration(c).then(() => {
      this.removeConfigurationConfirm = false;
      this.configurationToRemove = null;
    });
  }

  mounted() {
    this.ensureDefaultConfiguration();
  }

  async duplicateConfiguration(c: IDatasetConfiguration) {
    // TODO: temp choose location of the duplicated config
    if (!this.store.dataset) {
      return;
    }
    const config = await store.api.duplicateConfiguration(
      c,
      this.store.dataset.id
    );

    this.$router.push({
      name: "configuration",
      params: Object.assign({ config: config.id }, this.$route.params)
    });
  }

  async ensureDefaultConfiguration() {
    const { configurations, store } = this;

    const dataset = this.store.dataset;
    if (dataset === null || configurations.length > 0) {
      return;
    }

    try {
      const dataset = this.store.dataset;
      if (dataset === null) {
        throw new Error("Dataset not set");
      }

      const config = await store.createConfiguration({
        name: `${dataset.name} default configuration`,
        description: "Default configuration"
      });

      if (config === null) {
        throw new Error("Configuration not set");
      }

      this.configuration = [config];
    } catch (err) {
      throw err;
    }
  }
}
</script>
