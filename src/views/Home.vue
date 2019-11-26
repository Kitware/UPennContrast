<template>
  <v-container>
    <v-subheader>Recent Dataset Configurations</v-subheader>
    <v-list two-line>
      <v-list-item v-for="d in configurations" :key="d.id">
        <v-list-item-content>
          <v-list-item-title>{{ d.datasetName }} / {{ d.name }}</v-list-item-title>
          <v-list-item-subtitle>{{ d.description }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-btn
            icon
            :to="{
              name: 'configuration',
              params: {id: d.datasetId, config: d.id}
            }"
          >
            <v-icon>mdi-eye</v-icon>
          </v-btn>
        </v-list-item-action>
      </v-list-item>
    </v-list>

    <v-subheader>Browse</v-subheader>
    <girder-file-manager
      v-if="store.isLoggedIn"
      drag-enabled
      new-folder-enabled
      :location.sync="location"
      upload-multiple
      upload-enabled
      @rowclick="onRowClick"
    />
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Inject } from "vue-property-decorator";
import store from "@/store";
import { FileManager as GirderFileManager } from "@/girder";
import { IGirderLocation, IGirderSelectAble } from "@girder/components/src";

@Component({
  components: {
    GirderFileManager
  }
})
export default class Upload extends Vue {
  readonly store = store;

  get configurations() {
    return this.store.recentConfigurations;
  }

  get location() {
    return this.store.location;
  }

  set location(value: IGirderLocation | null) {
    this.store.changeLocation(value);
  }

  onRowClick(data: IGirderSelectAble) {
    if (
      data._modelType === "folder" &&
      data.meta.subtype === "contrastDataset"
    ) {
      this.$router.push({ name: "dataset", params: { id: data._id } });
    }
  }
}
</script>
