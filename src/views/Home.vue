<template>
  <v-container>
    <girder-file-manager
      v-if="store.isLoggedIn"
      v-model="selected"
      drag-enabled
      new-folder-enabled
      selectable
      :location.sync="location"
      upload-multiple
      upload-enabled
    />
  </v-container>
</template>

<script lang="ts">
import { Vue, Component, Inject } from "vue-property-decorator";
import store from "@/store";
import { FileManager as GirderFileManager } from "@/girder";
import { IGirderLocation } from "@girder/components/src";

@Component({
  components: {
    GirderFileManager
  }
})
export default class Upload extends Vue {
  readonly store = store;

  selected: any[] = [];
  internalLocation: IGirderLocation | null = null;

  get location() {
    return (
      this.internalLocation ||
      (this.store.isLoggedIn ? this.store.girderUser : { type: "collections" })
    );
  }

  set location(value: any) {
    this.internalLocation = value;
  }
}
</script>
