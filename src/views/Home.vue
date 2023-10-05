<template>
  <div>
    <v-alert :value="!store.isLoggedIn" color="info">Login to start</v-alert>
    <template v-if="store.isLoggedIn">
      <v-container class="home-container">
        <v-row class="home-row">
          <v-col class="fill-height">
            <section class="mb-4 home-section">
              <v-subheader class="headline mb-4">Upload Dataset</v-subheader>
              <!-- ADD DROPZONE HERE -->
            </section>
          </v-col>
          <v-col class="fill-height">
            <section class="mb-4 home-section">
              <v-subheader class="headline mb-4">Recent Dataset</v-subheader>
              <v-list two-line class="scrollable">
                <div v-for="d in datasetViewItems" :key="d.datasetView.id">
                  <v-tooltip
                    top
                    :disabled="
                      !datasetInfo[d.datasetView.datasetId] &&
                        !configInfo[d.datasetView.configurationId]
                    "
                  >
                    <template v-slot:activator="{ on, attrs }">
                      <v-list-item
                        @click="
                          $router.push({
                            name: 'datasetview',
                            params: {
                              datasetViewId: d.datasetView.id
                            }
                          })
                        "
                      >
                        <v-list-item-content v-bind="attrs" v-on="on">
                          <v-list-item-title>
                            {{
                              d.datasetInfo.name
                                ? d.datasetInfo.name
                                : "Unnamed dataset"
                            }}
                          </v-list-item-title>
                          <v-list-item-subtitle>
                            {{
                              d.configInfo.name
                                ? d.configInfo.name
                                : "Unnamed configuration"
                            }}
                          </v-list-item-subtitle>
                        </v-list-item-content>
                      </v-list-item>
                    </template>
                    <div v-if="d.datasetInfo.description">
                      {{ d.datasetInfo.description }}
                    </div>
                    <v-divider />
                    <div v-if="d.configInfo.description">
                      {{ d.configInfo.description }}
                    </div>
                  </v-tooltip>
                </div>
              </v-list>
            </section>
          </v-col>
        </v-row>
        <v-row class="home-row">
          <v-col class="fill-height">
            <section class="mb-4 home-section">
              <v-subheader class="headline mb-4">Browse</v-subheader>
              <custom-file-manager
                :location.sync="location"
                :initial-items-per-page="100"
                :items-per-page-options="[10, 20, 50, 100, -1]"
                @rowclick="onRowClick"
              />
            </section>
          </v-col>
        </v-row>
      </v-container>
    </template>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import {
  IGirderFolder,
  IGirderItem,
  IGirderLocation,
  IGirderSelectAble
} from "@/girder";
import girderResources from "@/store/girderResources";
import { IDatasetView } from "@/store/model";
import GirderLocationChooser from "@/components/GirderLocationChooser.vue";
import CustomFileManager from "@/components/CustomFileManager.vue";
import { isConfigurationItem, isDatasetFolder } from "@/utils/girderSelectable";

@Component({
  components: {
    GirderLocationChooser,
    CustomFileManager
  }
})
export default class Home extends Vue {
  readonly store = store;
  readonly girderResources = girderResources;

  location: IGirderLocation | null = null;

  get datasetViews() {
    const result: IDatasetView[] = [];
    const used: Set<string> = new Set();
    this.store.recentDatasetViews.forEach(datasetView => {
      if (!used.has(datasetView.id)) {
        used.add(datasetView.id);
        result.push(datasetView);
      }
    });
    return result;
  }

  get datasetInfo() {
    const infos: {
      [datasetId: string]: IGirderFolder | null;
    } = {};
    for (const datasetView of this.datasetViews) {
      const id = datasetView.datasetId;
      const folder = this.girderResources.watchFolder(id);
      infos[id] = folder || null;
    }
    return infos;
  }

  get configInfo() {
    const infos: {
      [configId: string]: IGirderItem | null;
    } = {};
    for (const datasetView of this.datasetViews) {
      const id = datasetView.configurationId;
      const item = this.girderResources.watchItem(id);
      infos[id] = item || null;
    }
    return infos;
  }

  get datasetViewItems() {
    const items = [];
    for (const datasetView of this.datasetViews) {
      const configInfo = this.configInfo[datasetView.configurationId];
      const datasetInfo = this.datasetInfo[datasetView.datasetId];
      if (!configInfo || !datasetInfo) {
        continue;
      }
      items.push({ datasetView, configInfo, datasetInfo });
    }
    return items;
  }

  @Watch("datasetViews")
  @Watch("girderResources.resources")
  fetchDatasetsAndConfigurations() {
    if (Object.keys(girderResources.resourcesLocks).length > 0) {
      // Some resources will be set later, don't spam getFolder and getItem
      return;
    }
    for (const d of this.datasetViews) {
      this.girderResources.getFolder(d.datasetId);
      this.girderResources.getItem(d.configurationId);
    }
  }

  mounted() {
    this.store.fetchRecentDatasetViews();
    this.fetchDatasetsAndConfigurations();
  }

  onRowClick(selectable: IGirderSelectAble) {
    if (isDatasetFolder(selectable)) {
      this.$router.push({
        name: "dataset",
        params: { datasetId: selectable._id }
      });
    }
    if (isConfigurationItem(selectable)) {
      this.$router.push({
        name: "configuration",
        params: { configurationId: selectable._id }
      });
    }
  }
}
</script>

<style lang="scss" scoped>
.home-row {
  height: 50%;
}

.home-container {
  height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
}

.home-section {
  display: flex;
  flex-direction: column;
  height: inherit;
}

.scrollable {
  overflow-y: auto;
  min-height: 0;
}
</style>
