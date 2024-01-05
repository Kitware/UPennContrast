<template>
  <div class="breadcrumbs">
    <alert-dialog ref="alert" />
    <!-- The breadcrumbs (dataset and configuration) -->
    <v-breadcrumbs :items="items" divider="" class="py-0 mx-2">
      <template #item="{ item }">
        <v-breadcrumbs-item class="breadcrumb-item mx-0 px-1 breadcrumb-span">
          {{ item.title }}
          <!-- If the item has subitems, use a select and an "info" icon -->
          <template v-if="item.subItems">
            <v-select
              :value="getCurrentViewItem(item.subItems)"
              @input="goToView"
              dense
              hide-details
              single-line
              height="1em"
              :items="item.subItems"
              :menu-props="{
                offsetY: true,
                closeOnClick: true,
                closeOnContentClick: true,
              }"
              class="body-2 ml-2 breadcrumb-select"
            >
              <template
                #append-item
                v-if="item.to.name == 'dataset' && configurationId"
              >
                <v-divider class="my-1" />
                <div
                  class="clickable-flex justify-center body-2"
                  @click="openAddDatasetDialog(configurationId)"
                >
                  <v-icon class="pr-2" color="primary">mdi-plus-circle</v-icon>
                  Add a dataset in this collection
                </div>
              </template>
            </v-select>
            <router-link :to="item.to">
              <v-icon>mdi-information</v-icon>
            </router-link>
          </template>
          <!-- Otherwise, simply make the item clickable -->
          <template v-else>
            <router-link :to="item.to">
              <span class="px-2">
                {{ item.text }}
              </span>
            </router-link>
          </template>
        </v-breadcrumbs-item>
      </template>
    </v-breadcrumbs>

    <!-- Dialog to add a dataset to the current collection -->
    <v-dialog
      content-class="smart-overflow"
      v-model="addDatasetFlag"
      width="60%"
    >
      <add-dataset-to-collection
        v-if="addDatasetCollection"
        :collection="addDatasetCollection"
        @addedDatasets="addedDatasets"
        @done="addDatasetFlag = false"
        @warning="openAlert({ type: 'warning', message: $event })"
        @error="openAlert({ type: 'error', message: $event })"
      />
    </v-dialog>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import girderResources from "@/store/girderResources";
import { Location } from "vue-router";
import { Dictionary } from "vue-router/types/router";
import AddDatasetToCollection from "@/components/AddDatasetToCollection.vue";

import { IDatasetConfiguration, IDatasetView } from "@/store/model";
import AlertDialog, { IAlert } from "@/components/AlertDialog.vue";

interface IBreadCrumbItem {
  title: string;
  to: Location;
  text: string;
  subItems?: {
    text: string;
    value: string;
  }[];
}

@Component({ components: { AddDatasetToCollection, AlertDialog } })
export default class BreadCrumbs extends Vue {
  readonly store = store;
  readonly girderResources = girderResources;

  readonly $refs!: {
    alert: AlertDialog;
  };

  items: IBreadCrumbItem[] = [];
  previousRefreshInfo: {
    datasetId: string | null;
    configurationId: string | null;
    routeName: string | null | undefined;
  } = {
    datasetId: null,
    configurationId: null,
    routeName: null,
  };

  addDatasetCollection: IDatasetConfiguration | null = null;

  get addDatasetFlag() {
    return this.addDatasetCollection !== null;
  }

  set addDatasetFlag(val: boolean) {
    if (!val) {
      this.addDatasetCollection = null;
    }
  }

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

  openAlert(alert: IAlert) {
    this.addDatasetFlag = false;
    this.$refs.alert.openAlert(alert);
  }

  async setItemTextWithResourceName(
    item: { text: string },
    id: string,
    type: "item" | "folder",
  ) {
    const resource = await this.girderResources.getResource({ id, type });
    if (resource) {
      Vue.set(item, "text", resource.name);
    }
  }

  async openAddDatasetDialog(configIdPromise: Promise<string>) {
    this.addDatasetCollection = await this.girderResources.getConfiguration(
      await configIdPromise,
    );
  }

  addedDatasets(_datasetIds: string[], datasetViews: IDatasetView[]) {
    // New datasets have been added to current collection
    this.refreshItems(true);
    // Close the dialog
    this.addDatasetFlag = false;
    // Go to the first dataset view if there is one
    if (datasetViews[0]) {
      this.goToView(datasetViews[0].id);
    }
  }

  @Watch("datasetId")
  @Watch("configurationId")
  async refreshItems(force = false) {
    const [configurationId, datasetId] = await Promise.all([
      this.configurationId,
      this.datasetId,
    ]);

    // Cache items if parameters are the same
    // This is useful when route query changes frequently but dataset and configuration don't
    if (
      !force &&
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
          params,
        },
        text: "Unknown dataset",
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
          params,
        },
        text: "Unknown configuration",
      };
      this.items.push(configurationItem);
      // Get name asynchronously
      this.setItemTextWithResourceName(
        configurationItem,
        configurationId,
        "item",
      );
    }

    // Drop-down if datasetItem and configurationId
    if (datasetItem && configurationId && this.$route.name === "datasetview") {
      const capturedDatasetItem = datasetItem;
      this.store.api.findDatasetViews({ configurationId }).then((views) => {
        if (!views.length) {
          return;
        }
        const datasetItems: IBreadCrumbItem["subItems"] = views.map((view) => {
          const viewItem = {
            text: "Unknown dataset",
            value: view.id,
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
    return subitems.find((subitem) => subitem.value === datasetViewId) || null;
  }

  goToView(datasetViewId: string) {
    const currentDatasetViewId = this.$route.params?.datasetViewId;
    if (currentDatasetViewId === datasetViewId) {
      return;
    }
    this.$router.push({
      name: "datasetview",
      params: { datasetViewId },
      query: { ...this.$route.query },
    });
  }
}
</script>

<style lang="scss" scoped>
.breadcrumbs {
  overflow: hidden;
  white-space: nowrap;
}

.breadcrumb-select input {
  width: 20px;
}

.breadcrumb-select {
  min-width: 0;
}

.breadcrumb-span {
  display: flex;
  max-width: max-content;
  overflow: hidden;
}

.breadcrumb-item {
  max-width: 100%;
}
</style>

<style lang="scss">
.breadcrumb-item .v-breadcrumbs__item {
  max-width: inherit;
}

.v-alert__content {
  min-width: 0;
}
</style>
