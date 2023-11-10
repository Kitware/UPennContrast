<template>
  <div class="breadcrumbs">
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
                closeOnContentClick: true
              }"
              class="body-2 ml-2 breadcrumb-select"
            >
              <template
                #append-item
                v-if="item.to.name == 'dataset' && configurationId"
              >
                <v-divider class="my-1" />
                <a
                  class="d-flex align-center justify-center body-2"
                  @click="openAddDatasetDialog(configurationId)"
                >
                  <v-icon>mdi-plus</v-icon>
                  Add a dataset in this collection
                </a>
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
    <v-dialog v-model="addDatasetDialog" v-if="addDatasetConfig" width="60%">
      <v-card>
        <v-card-title class="mb-4">
          <span class="text--secondary">Adding dataset to collection:</span>
          <span class="text--primary">{{ addDatasetConfig.name }}</span>
        </v-card-title>
        <v-card-text>
          <v-radio-group v-model="addDatasetOptionType">
            <v-radio
              label="Add an existing dataset to the current collection"
              value="add"
            />
            <v-radio
              label="Upload new dataset and add to current collection"
              value="upload"
            />
          </v-radio-group>
          <template v-if="addDatasetOption.type == 'add'">
            <girder-location-chooser
              @input="selectAddDatasetFolder"
              :breadcrumb="true"
              title="Choose a dataset or a folder of datasets to add in the current Configuration"
            />
            <v-alert
              v-if="addDatasetOption.message"
              type="warning"
              class="my-2"
              dense
            >
              {{ addDatasetOption.message }}
            </v-alert>
            <v-alert
              v-if="addDatasetOption.datasets.length > 0"
              type="success"
              class="my-2"
              dense
            >
              Selected {{ addDatasetOption.datasets.length }} dataset(s):
              <v-divider />
              <div
                v-for="dataset in addDatasetOption.datasets"
                :key="'selected-' + dataset.id"
              >
                {{ dataset.name }}
                <v-divider />
              </div>
            </v-alert>
            <v-card-actions class="ma-2">
              <v-spacer />
              <v-btn
                color="green"
                :disabled="!canAddDatasetToCollection"
                @click="addDatasetToCollection"
              >
                Add dataset
              </v-btn>
            </v-card-actions>
          </template>
          <template v-if="addDatasetOption.type == 'upload'">
            <new-dataset
              @datasetUploaded="addDatasetToCollectionUploaded"
              :autoMultiConfig="false"
            />
            <div class="d-flex justify-end mt-2">
              <v-simple-checkbox v-model="addDatasetEditVariables" dense />
              Review variables
            </div>
            <tempalte v-if="addDatasetConfiguring">
              <multi-source-configuration
                ref="configuration"
                :datasetId="addDatasetUploadedDatasetId"
                :autoDatasetRoute="false"
                @log="addDatasetConfigurationLogs = $event"
                @generatedJson="addDatasetConfigurationDone"
                :class="{ 'd-none': !addDatasetEditVariables }"
              />
              <div class="title mb-2">
                Configuring the dataset
              </div>
              <v-progress-circular indeterminate />
              <div class="code-container" v-if="addDatasetConfigurationLogs">
                <code class="code-block">
                  {{ addDatasetConfigurationLogs }}
                </code>
              </div>
            </tempalte>
          </template>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import girderResources from "@/store/girderResources";
import { Location } from "vue-router";
import { Dictionary } from "vue-router/types/router";
import { IDataset, IDatasetConfiguration, areCompatibles } from "@/store/model";
import GirderLocationChooser from "@/components/GirderLocationChooser.vue";

import NewDataset from "@/views/dataset/NewDataset.vue";
import { IGirderSelectAble } from "@/girder";
import { isDatasetFolder } from "@/utils/girderSelectable";
import { getDatasetCompatibility } from "@/store/GirderAPI";
import { logError } from "@/utils/log";
import MultiSourceConfiguration from "@/views/dataset/MultiSourceConfiguration.vue";

interface IBreadCrumbItem {
  title: string;
  to: Location;
  text: string;
  subItems?: {
    text: string;
    value: string;
  }[];
}

type TAddDatasetOption =
  | { type: "upload" }
  | { type: "add"; datasets: IDataset[]; message: string };

function defaultDatasetUploadOption(): TAddDatasetOption {
  return {
    type: "upload"
  };
}

function defaultDatasetAddOption(): TAddDatasetOption {
  return {
    type: "add",
    datasets: [],
    message: ""
  };
}

@Component({
  components: { GirderLocationChooser, MultiSourceConfiguration, NewDataset }
})
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

  addDatasetConfig: IDatasetConfiguration | null = null;
  addDatasetOption: TAddDatasetOption = defaultDatasetUploadOption();
  addDatasetEditVariables: boolean = false;
  addDatasetConfiguring: boolean = false;
  addDatasetConfigurationLogs = "";
  addDatasetUploadedDatasetId: string | null = null;
  $refs!: {
    configuration?: MultiSourceConfiguration;
  };

  get addDatasetOptionType(): TAddDatasetOption["type"] {
    return this.addDatasetOption.type;
  }

  set addDatasetOptionType(type: TAddDatasetOption["type"]) {
    switch (type) {
      case "add":
        this.addDatasetOption = defaultDatasetAddOption();
        break;
      case "upload":
        this.addDatasetOption = defaultDatasetUploadOption();
        break;
    }
  }

  async openAddDatasetDialog(configIdPromise: Promise<string>) {
    const configId = await configIdPromise;
    this.addDatasetConfig = await this.girderResources.getConfiguration(
      configId
    );
    this.addDatasetOption = defaultDatasetUploadOption();
    this.addDatasetEditVariables = false;
  }

  get addDatasetDialog() {
    return this.addDatasetConfig !== null;
  }

  set addDatasetDialog(value: boolean) {
    if (!value) {
      this.addDatasetConfig = null;
    }
  }

  async selectAddDatasetFolder(location: IGirderSelectAble | null) {
    const option = this.addDatasetOption;
    if (option.type !== "add" || !this.addDatasetConfig) {
      return;
    }
    const datasets: IDataset[] = [];
    // User didn't select a valid folder
    if (!location || location._modelType !== "folder") {
      option.datasets = datasets;
      option.message =
        "Selected location is invalid. Select a dataset or a folder containing datasets.";
      return;
    }
    // User selected a folder
    const foldersToCheck = [location];
    if (!isDatasetFolder(location)) {
      const childrenFolders = await this.store.api.getFolders(location._id);
      foldersToCheck.push(...childrenFolders);
    }
    for (const folder of foldersToCheck) {
      if (!isDatasetFolder(folder)) {
        continue;
      }
      const dataset = await this.girderResources.getDataset({
        id: folder._id
      });
      if (dataset) {
        datasets.push(dataset);
      }
    }
    if (datasets.length === 0) {
      option.message =
        "The selected folder is not a dataset and doesn't contain a dataset.";
      return;
    }

    // Filter compatible datasets
    const configCompat = this.addDatasetConfig.compatibility;
    const configViews = await this.store.api.findDatasetViews({
      configurationId: this.addDatasetConfig.id
    });
    const excludeDatasetIds = new Set(configViews.map(view => view.datasetId));
    const compatibleDatasets = datasets.filter(
      dataset =>
        !excludeDatasetIds.has(dataset.id) &&
        areCompatibles(configCompat, getDatasetCompatibility(dataset))
    );
    if (compatibleDatasets.length === 0) {
      option.message =
        "Selected datasets are not compatible with the current configuration";
      return;
    }
    option.datasets = compatibleDatasets;
    option.message = "";
  }

  get canAddDatasetToCollection(): boolean {
    if (this.addDatasetConfig === null) {
      return false;
    }
    switch (this.addDatasetOption.type) {
      case "add":
        return this.addDatasetOption.datasets.length > 0;
      case "upload":
        return false;
    }
  }

  async addDatasetToCollectionUploaded(datasetId: string) {
    this.addDatasetUploadedDatasetId = datasetId;
    this.addDatasetConfigurationLogs = "";
    this.addDatasetConfiguring = true;

    // Automatic generation of the JSON
    if (!this.addDatasetEditVariables) {
      await Vue.nextTick();
      const config = this.$refs.configuration;
      if (!config) {
        logError(
          "MultiSourceConfiguration component not mounted during configuration of new dataset"
        );
        this.addDatasetEditVariables = true;
        return;
      }
      // Ensure that the component is initialized
      await (config.initialized || config.initialize());
      await config.submit();
    }
  }

  async addDatasetConfigurationDone(jsonId: string | null) {
    this.addDatasetConfiguring = false;
    const datasetId = this.addDatasetUploadedDatasetId!;
    if (!jsonId) {
      logError("Failed to generate JSON during configuration of new dataset");
      this.addDatasetEditVariables = true;
      return;
    }
    // Check if dataset is compatible with configuration
    const configCompat = this.addDatasetConfig?.compatibility;
    if (!configCompat) {
      logError(
        "DatasetConfiguration missing after multi source configuration of dataset"
      );
      return;
    }
    const dataset = await this.girderResources.getDataset({ id: datasetId });
    if (!dataset) {
      logError("Dataset missing after multi source configuration of dataset");
      return;
    }
    const datasetCompat = getDatasetCompatibility(dataset);
    if (!areCompatibles(configCompat, datasetCompat)) {
      logError("Incompatible dataset uploaded");
      return;
    }
    // Set the dataset now that multi-source is available
    await this.store.setSelectedDataset(datasetId);
    this.addDatasetToCollection();
  }

  async addDatasetToCollection() {
    if (!this.addDatasetConfig) {
      return;
    }
    const configurationId = this.addDatasetConfig.id;
    const datasetIds: string[] = [];

    switch (this.addDatasetOption.type) {
      case "add":
        this.addDatasetOption.datasets.forEach(d => datasetIds.push(d.id));
        break;
      case "upload":
        datasetIds.push(this.addDatasetUploadedDatasetId!);
        break;
    }

    const promises = datasetIds.map(datasetId =>
      this.store.createDatasetView({
        datasetId,
        configurationId
      })
    );
    await Promise.all(promises);

    this.refreshItems(true);

    this.addDatasetDialog = false;
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
  async refreshItems(force = false) {
    const [configurationId, datasetId] = await Promise.all([
      this.configurationId,
      this.datasetId
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
