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

    <section>
      <v-subheader>Browse</v-subheader>
      <custom-file-manager
        :location.sync="location"
        :initial-items-per-page="100"
        :items-per-page-options="[10, 20, 50, 100, -1]"
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
  location: IGirderLocation | null = null;
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
