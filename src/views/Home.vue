<template>
  <v-container>
    <v-alert :value="!store.isLoggedIn" color="info">Login to start</v-alert>
    <section v-if="store.isLoggedIn">
      <v-subheader>Recent Dataset</v-subheader>
      <v-list two-line>
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

    <section v-if="store.isLoggedIn">
      <v-subheader>Browse</v-subheader>
      <girder-file-manager
        drag-enabled
        new-folder-enabled
        :location.sync="location"
        :initial-items-per-page="itemsPerPage"
        :items-per-page-options="itemsPerPageOptions"
        @rowclick="onRowClick"
      />
    </section>
  </v-container>
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
import { IDatasetView } from "@/store/model";

@Component({
  components: {
    GirderFileManager: () =>
      import("@/girder/components").then(mod => mod.FileManager)
  }
})
export default class Upload extends Vue {
  readonly store = store;
  location: IGirderLocation = { type: "root" };
  datasetInfo: {
    [datasetId: string]: IGirderFolder;
  } = {};
  configInfo: {
    [configurationId: string]: IGirderItem;
  } = {};

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

  get datasetViewItems() {
    return this.datasetViews.map(datasetView => {
      return {
        datasetView,
        configInfo: this.configInfo[datasetView.configurationId] || {},
        datasetInfo: this.datasetInfo[datasetView.datasetId] || {}
      };
    });
  }

  @Watch("datasetViews")
  fetchDatasetsAndConfigurations() {
    const promises = [];
    for (const d of this.datasetViews) {
      if (!(d.datasetId in this.datasetInfo)) {
        promises.push(
          this.store.api
            .getFolder(d.datasetId)
            .then(folder => Vue.set(this.datasetInfo, d.datasetId, folder))
        );
      }
      if (!(d.configurationId in this.configInfo)) {
        promises.push(
          this.store.api
            .getItem(d.configurationId)
            .then(item => Vue.set(this.configInfo, d.configurationId, item))
        );
      }
    }
    return Promise.all(promises);
  }

  mounted() {
    this.store.fetchRecentDatasetViews();
    this.fetchDatasetsAndConfigurations();
  }

  onRowClick(data: IGirderSelectAble) {
    if (
      data._modelType === "folder" &&
      data.meta.subtype === "contrastDataset"
    ) {
      this.$router.push({ name: "dataset", params: { datasetId: data._id } });
    }
    if (
      data._modelType === "item" &&
      data.meta.subtype === "contrastConfiguration"
    ) {
      this.$router.push({
        name: "configuration",
        params: { configurationId: data._id }
      });
    }
  }

  data() {
    return {
      itemsPerPage: 100,
      itemsPerPageOptions: [10, 20, 50, 100, -1]
    };
  }
}
</script>
