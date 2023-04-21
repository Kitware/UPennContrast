<template>
  <v-breadcrumbs :items="items" divider="">
    <template v-slot:item="{ item }">
      <span class="mx-0 px-1">
        <v-breadcrumbs-item class="ma-0 pa-0">
          {{ item.title }}
        </v-breadcrumbs-item>
        <v-breadcrumbs-item v-bind="item" class="px-2">
          {{ item.text }}
        </v-breadcrumbs-item>
      </span>
    </template>
  </v-breadcrumbs>
</template>
<style lang="scss" scoped>
.v-breadcrumbs {
  overflow: hidden;
  white-space: nowrap;
}
</style>

<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import { Dictionary } from "vue-router/types/router";

@Component
export default class BreadCrumbs extends Vue {
  readonly store = store;
  items: {
    exact: boolean;
    text: string;
    to: {
      name: string;
      params: Dictionary<string>;
    };
    title: string;
  }[] = [];

  get datasetView() {
    const { datasetViewId } = this.$route.params;
    if (datasetViewId) {
      return this.store.api.getDatasetView(datasetViewId);
    }
    return null;
  }

  get datasetId(): Promise<string> | null {
    const paramsId = this.$route.params.datasetId;
    const queryId = this.$route.query.datasetId;
    if (paramsId) {
      return Promise.resolve(paramsId);
    }
    if (queryId && typeof queryId === "string") {
      return Promise.resolve(queryId);
    }
    if (this.datasetView) {
      return this.datasetView.then(({ datasetId }) => datasetId);
    }
    return null;
  }

  get datasetFolder() {
    return this.datasetId?.then(id => this.store.api.getFolder(id)) || null;
  }

  get configurationId(): Promise<string> | null {
    const paramsId = this.$route.params.configurationId;
    const queryId = this.$route.query.configurationId;
    if (paramsId) {
      return Promise.resolve(paramsId);
    }
    if (queryId && typeof queryId === "string") {
      return Promise.resolve(queryId);
    }
    if (this.datasetView) {
      return this.datasetView.then(({ configurationId }) => configurationId);
    }
    return null;
  }

  get configurationItem() {
    return this.configurationId?.then(id => this.store.api.getItem(id)) || null;
  }

  mounted() {
    this.refreshItems();
  }

  @Watch("$route")
  async refreshItems() {
    let index = 0;
    const breadCrumbs = [
      {
        title: "Dataset:",
        to: {
          name: "dataset",
          params: { ...this.$route.params, datasetId: await this.datasetId }
        },
        recordPromise: this.datasetFolder
      },
      {
        title: "Configuration:",
        to: {
          name: "configuration",
          params: {
            ...this.$route.params,
            configurationId: await this.configurationId
          }
        },
        recordPromise: this.configurationItem
      }
    ];
    this.items = [];
    for (const { title, to, recordPromise } of breadCrumbs) {
      if (recordPromise) {
        const capturedIndex = index;
        recordPromise.then(record => {
          Vue.set(this.items, capturedIndex, {
            exact: true,
            text: record.name,
            to,
            title
          });
        });
        index++;
      }
    }
  }
}
</script>
