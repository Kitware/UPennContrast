<template>
  <v-container>
    <v-form v-model="valid">
      <girder-upload
        v-if="path"
        ref="uploader"
        :dest="path"
        hideStartButton
        hideHeadline
        @filesChanged="filesChanged"
        @done="uploadDone = true"
      />

      <v-text-field
        v-model="name"
        label="Name"
        required
        :rules="rules"
        :readonly="pageTwo"
      />

      <v-textarea
        v-model="description"
        label="Description"
        :readonly="pageTwo"
        rows="2"
      />

      <div class="button-bar">
        <v-btn
          v-if="dataset == null"
          :disabled="!valid || !filesSelected"
          color="success"
          class="mr-4"
          @click="submit"
          >Upload</v-btn
        >
        <v-btn
          v-else
          color="success"
          class="mr-4"
          :to="{ name: 'dataset', params: { id: dataset.id } }"
          >View Dataset</v-btn
        >
      </div>
    </v-form>
  </v-container>
</template>
<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";
import { IGirderSelectAble } from "@/girder";
import GirderLocationChooser from "@/components/GirderLocationChooser.vue";
import { IDataset } from "@/store/model";

@Component({
  components: {
    GirderLocationChooser,
    GirderUpload: () => import("@/girder/components").then(mod => mod.Upload)
  }
})
export default class NewDataset extends Vue {
  readonly store = store;

  valid = false;
  filesSelected = false;
  name = "";
  description = "";

  path: IGirderSelectAble | null = null;

  dataset: IDataset | null = null;

  uploadDone = false;

  get pageTwo() {
    return this.dataset != null;
  }

  get pathName() {
    return this.path ? this.path.name : "";
  }

  get rules() {
    return [(v: string) => v.trim().length > 0 || `value is required`];
  }

  async mounted() {
    this.path = await this.store.api.getUserPublicFolder();
  }

  async submit() {
    if (!this.valid) {
      return;
    }

    this.dataset = await this.store.createDataset({
      name: this.name,
      description: this.description,
      path: this.path!
    });

    this.path = this.dataset._girder;

    await Vue.nextTick();

    this.$refs.uploader.startUpload();
  }

  filesChanged(files) {
    this.filesSelected = files.length > 0;
  }
}
</script>
