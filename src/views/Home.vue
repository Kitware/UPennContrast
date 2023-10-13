<template>
  <div>
    <v-alert :value="!store.isLoggedIn" color="info">Login to start</v-alert>
    <template v-if="store.isLoggedIn">
      <v-container class="home-container">
        <v-row class="home-row">
          <v-col class="fill-height">
            <section class="mb-4 home-section">
              <v-subheader class="headline mb-4">Upload Dataset</v-subheader>
              <v-card>
                <v-tabs v-model="uploadTab">
                  <v-tab>
                    Quick Upload and View Dataset
                  </v-tab>
                  <v-tab>
                    Comprehensive Upload
                  </v-tab>
                </v-tabs>
              </v-card>
              <v-tabs-items v-model="uploadTab" class="flex-window-items">
                <v-tab-item>
                  <file-dropzone @input="quickUpload">
                    <template #afterMessage>
                      <span class="caption">
                        <v-icon size="14px" class="py-1">
                          mdi-information
                        </v-icon>
                        Default collection will be created in same folder as
                        dataset
                      </span>
                    </template>
                  </file-dropzone>
                </v-tab-item>
                <v-tab-item>
                  <file-dropzone @input="comprehensiveUpload" />
                </v-tab-item>
              </v-tabs-items>
            </section>
          </v-col>
          <v-col class="fill-height">
            <section class="mb-4 home-section">
              <v-subheader class="headline mb-4">Recent Dataset</v-subheader>
              <v-list two-line class="scrollable py-0">
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
import { Upload as GirderUpload } from "@/girder/components";
import FileDropzone from "@/components/Files/FileDropzone.vue";
import CustomFileManager from "@/components/CustomFileManager.vue";
import { isConfigurationItem, isDatasetFolder } from "@/utils/girderSelectable";

@Component({
  components: {
    GirderUpload,
    FileDropzone,
    GirderLocationChooser,
    CustomFileManager
  }
})
export default class Home extends Vue {
  readonly store = store;
  readonly girderResources = girderResources;

  location: IGirderLocation | null = null;

  uploadTab: number = 0;

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

  quickUpload(files: File[]) {
    // Use params to pass props to NewDataset component
    // RouteConfig in src/view/dataset/index.ts has to support it
    this.$router.push({
      name: "newdataset",
      params: { value: files, quickupload: true } as any
    });
  }

  comprehensiveUpload(files: File[]) {
    // Use params to pass props to NewDataset component
    // RouteConfig in src/view/dataset/index.ts has to support it
    this.$router.push({
      name: "newdataset",
      params: { value: files } as any
    });
  }
}
</script>

<style lang="scss" scoped>
.home-row:nth-of-type(1) {
  height: 40%;
}

.home-row:nth-of-type(2) {
  height: 60%;
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
  height: inherit;
}
</style>

<style lang="scss">
.flex-window-items,
.flex-window-items .v-window-item {
  height: inherit;
}
</style>
