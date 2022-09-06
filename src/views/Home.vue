<template>
  <v-container>
    <v-alert :value="!store.isLoggedIn" color="info">Login to start</v-alert>
    <section v-if="store.isLoggedIn">
      <v-subheader>Recent Dataset Configurations</v-subheader>
      <v-list two-line>
        <v-list-item
          v-for="d in configurations"
          :key="d.id"
          @click="
            $router.push({
              name: 'view',
              params: { id: d.datasetId, config: d.id }
            })
          "
        >
          <v-list-item-content>
            <v-list-item-title
              >{{ d.datasetName }} / {{ d.name }}</v-list-item-title
            >
            <v-list-item-subtitle>{{ d.description }}</v-list-item-subtitle>
          </v-list-item-content>
          <v-list-item-action>
            <v-btn
              icon
              :to="{
                name: 'view',
                params: { id: d.datasetId, config: d.id }
              }"
            >
              <v-icon>mdi-eye</v-icon>
            </v-btn>
          </v-list-item-action>
        </v-list-item>
      </v-list>
    </section>

    <section v-if="store.isLoggedIn">
      <v-subheader>Browse</v-subheader>
      <girder-file-manager
        drag-enabled
        new-folder-enabled
        :location.sync="location"
        upload-multiple
        upload-enabled
        :initial-items-per-page="itemsPerPage"
        :items-per-page-options="itemsPerPageOptions"
        @rowclick="onRowClick"
      />
    </section>

    <v-subheader>Actions</v-subheader>
    <div class="button-bar">
      <v-btn
        color="primary"
        :to="{ name: 'newdataset' }"
        :disabled="!store.isLoggedIn"
      >
        Upload Data
      </v-btn>
    </div>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";
import { IGirderLocation, IGirderSelectAble } from "@/girder";

@Component({
  components: {
    GirderFileManager: () =>
      import("@/girder/components").then(mod => mod.FileManager)
  }
})
export default class Upload extends Vue {
  readonly store = store;
  location: IGirderLocation = { type: "root" };

  get configurations() {
    const result = [];
    const used = {};
    this.store.recentConfigurations.forEach(conf => {
      if (!used[conf.id]) {
        used[conf.id] = true;
        result.push(conf);
      }
    });
    return result;
  }

  onRowClick(data: IGirderSelectAble) {
    if (
      data._modelType === "folder" &&
      data.meta.subtype === "contrastDataset"
    ) {
      this.$router.push({ name: "dataset", params: { id: data._id } });
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
