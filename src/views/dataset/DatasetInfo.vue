<template>
  <v-container>
    <v-row>
      <v-data-table
        :headers="headers"
        :items="report"
        class="elevation-3"
        hide-default-header
        hide-default-footer
      />
    </v-row>

    <v-subheader>
      <span class="grow">Configurations</span>
      <v-btn
        color="primary"
        :to="{
          name: 'newconfiguration',
          params: Object.assign({ id: '' }, $route.params)
        }"
        >Add Configuration</v-btn
      >
    </v-subheader>
    <v-list two-line>
      <v-list-item
        v-for="c in configurations"
        :key="c.name"
        @click="$router.push(toRoute(c))"
      >
        <v-list-item-content>
          <v-list-item-title>{{ c.name }}</v-list-item-title>
          <v-list-item-subtitle>{{ c.description }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-btn icon :to="toRoute(c)">
            <v-icon>mdi-eye</v-icon>
          </v-btn>
        </v-list-item-action>
      </v-list-item>
    </v-list>
    <div class="button-bar">
      <v-dialog v-model="removeConfirm" max-width="33vw">
        <template #activator="{ on }">
          <v-btn color="warning" v-on="on" :disabled="!store.dataset">
            <v-icon left>mdi-close</v-icon>
            Remove
          </v-btn>
        </template>
        <v-card>
          <v-card-title>Are you sure to remove "{{ name }}"?</v-card-title>
          <v-card-actions class="button-bar">
            <v-btn @click="removeConfirm = false">Cancel</v-btn>
            <v-btn @click="remove" color="warning">Remove</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
      <v-btn
        color="primary"
        :to="configurations.length > 0 ? toRoute(configurations[0]) : undefined"
        :disabled="configurations.length === 0"
      >
        <v-icon left>mdi-eye</v-icon>
        View
      </v-btn>
    </div>
  </v-container>
</template>
<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";
import { IDatasetConfiguration, newLayer } from "../../store/model";

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = ("0" + (d.getMonth() + 1)).slice(-2);
  const day = ("0" + d.getDate()).slice(-2);
  const hour = ("0" + d.getHours()).slice(-2);
  const minute = ("0" + d.getMinutes()).slice(-2);

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

@Component
export default class DatasetInfo extends Vue {
  readonly store = store;

  removeConfirm = false;
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
      params: Object.assign({ config: c.id }, this.$route.params)
    };
  }

  remove() {
    this.store.deleteDataset(this.store.dataset!).then(() => {
      this.removeConfirm = false;
      this.$router.push({
        name: "root"
      });
    });
  }

  mounted() {
    this.ensureDefaultConfiguration();
  }

  async ensureDefaultConfiguration() {
    const { configurations, store } = this;

    const dataset = this.store.dataset;
    if (dataset === null || configurations.length > 0) {
      return;
    }

    const date = new Date();
    try {
      const config = await store.createConfiguration({
        name: `default ${formatDate(date)}`,
        description: "default configuration"
      });

      const dataset = this.store.dataset;
      const channels = dataset.channels.slice(0, 6);
      const layers = channels.map(() => newLayer(dataset, []));
      const colors = [
        "#FF0000",
        "#00FF00",
        "#0000FF",
        "#00FFFF",
        "#FF00FF",
        "#FFFF00",
      ];
      channels.forEach((c, i) => {
        const layer = layers[i];
        layer.channel = c;
        layer.color = channels.length === 1 ? "#FFFFFF" : colors[i];
        layer.name = dataset.channelNames.get(c) || `Channel ${c}`;
      });

      config.layers = layers;
      await store.api.updateConfiguration(config);

      this.configuration = [config!];
    } catch (err) {
      throw err;
    }
  }
}
</script>
