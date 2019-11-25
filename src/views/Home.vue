<template>
  <v-container>
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

  get location() {
    return this.store.location;
  }

  set location(value: IGirderLocation | null) {
    this.store.changeLocation(value);
  }

  onRowClick(data: IGirderSelectAble) {
    console.log(data);
    debugger;
    if (
      data._modelType === "folder" &&
      data.meta.subtype === "contrastDataset"
    ) {
      this.$router.push({ name: "dataset", params: { id: data._id } });
    }
  }
}
</script>
