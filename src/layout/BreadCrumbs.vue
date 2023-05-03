<template>
  <v-breadcrumbs :items="items" divider="">
    <template v-slot:item="{ item }">
      <span class="mx-0 px-1">
        <v-breadcrumbs-item>
          {{ item.title }}
        </v-breadcrumbs-item>
        <v-breadcrumbs-item v-if="item.subItems" :to="item.to">
          <v-select
            :value="getCurrentViewItem(item.subItems)"
            @input="goToView"
            dense
            hide-details
            single-line
            height="1em"
            :items="item.subItems"
            class="body-2 small-input"
            @click.prevent
          />
          <v-icon>mdi-information</v-icon>
        </v-breadcrumbs-item>
        <v-breadcrumbs-item v-else :to="item.to">
          <span class="px-2">
            {{ item.text }}
          </span>
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
import { Location } from "vue-router";
import { IDatasetView } from "@/store/model";
import { Dictionary } from "vue-router/types/router";

interface IBreadCrumbItem {
  title: string;
  to: Location;
  text: string;
  subItems?: {
    text: string;
    value: string;
  }[];
}

@Component
export default class BreadCrumbs extends Vue {
  readonly store = store;
  items: IBreadCrumbItem[] = [];

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

  mounted() {
    this.refreshItems();
  }

  @Watch("$route")
  async refreshItems() {
    const [configurationId, datasetId] = await Promise.all([
      this.configurationId,
      this.datasetId
    ]);
    this.items = [];

    // Dataset Item
    let datasetItem: IBreadCrumbItem | undefined;
    const params: Dictionary<string> = {};
    if (datasetId) {
      params.datasetId = datasetId;
    }
    if (configurationId) {
      params.configurationId = configurationId;
    }
    if (datasetId) {
      datasetItem = {
        title: "Dataset:",
        to: {
          name: "dataset",
          params
        },
        text: "Unknown dataset"
      };
      this.items.push(datasetItem);
      // Get name asynchronously
      const capturedItem = datasetItem;
      this.store.api
        .getFolder(datasetId)
        .then(folder => Vue.set(capturedItem, "text", folder.name));
    }

    // Configuration Item
    let configurationItem: IBreadCrumbItem | undefined;
    if (configurationId) {
      configurationItem = {
        title: "Configuration:",
        to: {
          name: "configuration",
          params
        },
        text: "Unknown configuration"
      };
      this.items.push(configurationItem);
      // Get name asynchronously
      const capturedItem = configurationItem;
      this.store.api
        .getItem(configurationId)
        .then(item => Vue.set(capturedItem, "text", item.name));
    }

    // Drop-down if datasetItem and configurationId
    if (datasetItem && configurationId && this.$route.name === "datasetview") {
      const capturedDatasetItem = datasetItem;
      this.store.api.findDatasetViews({ configurationId }).then(views => {
        if (!views.length) {
          return;
        }
        const datasetItems: IBreadCrumbItem["subItems"] = views.map(view => {
          const viewItem = {
            text: "Unknown dataset",
            value: view.id
          };
          // Get name asynchronously
          const capturedItem = viewItem;
          this.store.api
            .getFolder(view.datasetId)
            .then(folder => Vue.set(capturedItem, "text", folder.name));
          return viewItem;
        });
        Vue.set(capturedDatasetItem, "subItems", datasetItems);
      });
    }
  }

  getCurrentViewItem(subitems: IBreadCrumbItem["subItems"]) {
    if (!subitems) {
      return null;
    }
    const { datasetViewId } = this.$route.params;
    if (!datasetViewId) {
      return null;
    }
    return subitems.find(subitem => subitem.value === datasetViewId) || null;
  }

  goToView(datasetViewId: string) {
    const currentDatasetViewId = this.$route.params?.datasetViewId;
    if (currentDatasetViewId === datasetViewId) {
      return;
    }
    this.$router.push({
      name: "datasetview",
      params: { datasetViewId },
      query: { ...this.$route.query }
    });
  }
}
</script>

<style>
.small-input input {
  width: 1em;
}
</style>
