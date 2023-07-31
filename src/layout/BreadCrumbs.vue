<template>
  <v-breadcrumbs :items="items" divider="" class="py-0">
    <template v-slot:item="{ item }">
      <v-breadcrumbs-item class="mx-0 px-1 breadcrumb-item">
        {{ item.title }}
        <template v-if="item.subItems">
          <v-select
            :value="getCurrentViewItem(item.subItems)"
            @input="goToView"
            dense
            hide-details
            single-line
            height="1em"
            :items="item.subItems"
            class="body-2 ml-2 breadcrumb-select"
            @click.prevent
          />
          <v-icon :to="item.to">mdi-information</v-icon>
        </template>
        <template v-else>
          <span class="px-2" :to="item.to">
            {{ item.text }}
          </span>
        </template>
      </v-breadcrumbs-item>
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
import girderResources from "@/store/girderResources";
import { Location } from "vue-router";
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
  readonly girderResources = girderResources;

  items: IBreadCrumbItem[] = [];
  previousRefreshInfo: {
    datasetId: string | null;
    configurationId: string | null;
    routeName: string | null | undefined;
  } = {
    datasetId: null,
    configurationId: null,
    routeName: null
  };

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
    if (this.datasetView) {
      return this.datasetView.then(({ configurationId }) => configurationId);
    }
    if (paramsId) {
      return Promise.resolve(paramsId);
    }
    if (queryId && typeof queryId === "string") {
      return Promise.resolve(queryId);
    }
    return null;
  }

  mounted() {
    this.refreshItems();
  }

  async setItemTextWithResourceName(
    item: { text: string },
    id: string,
    type: "item" | "folder"
  ) {
    const resource = await this.girderResources.getResource({ id, type });
    if (resource) {
      Vue.set(item, "text", resource.name);
    }
  }

  @Watch("datasetId")
  @Watch("configurationId")
  async refreshItems() {
    const [configurationId, datasetId] = await Promise.all([
      this.configurationId,
      this.datasetId
    ]);

    // Cache items if parameters are the same
    // This is useful when route query changes frequently but dataset and configuration don't
    if (
      datasetId === this.previousRefreshInfo.datasetId &&
      configurationId === this.previousRefreshInfo.configurationId &&
      this.$route.name === this.previousRefreshInfo.routeName
    ) {
      return;
    }
    this.previousRefreshInfo.datasetId = datasetId;
    this.previousRefreshInfo.configurationId = configurationId;
    this.previousRefreshInfo.routeName = this.$route.name;

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
      this.setItemTextWithResourceName(datasetItem, datasetId, "folder");
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
      this.setItemTextWithResourceName(
        configurationItem,
        configurationId,
        "item"
      );
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
          this.setItemTextWithResourceName(viewItem, view.datasetId, "folder");
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
.breadcrumb-select input {
  width: 20px;
}
</style>
