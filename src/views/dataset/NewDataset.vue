<template>
  <v-container>
    <v-form v-model="valid">
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
      />

      <template v-if="dataset != null">
        <v-subheader>Images</v-subheader>
        <girder-upload
          accept=".ome.tif"
          :dest="dataset._girder"
          @done="uploadDone = true"
        />
      </template>

      <div class="button-bar">
        <v-btn
          :disabled="!valid"
          color="success"
          class="mr-4"
          @click="submit"
          v-if="dataset == null"
          >Create</v-btn
        >
        <v-btn
          :disabled="!uploadDone"
          color="success"
          class="mr-4"
          v-else
          :to="{ name: 'dataset', params: { id: dataset.id } }"
          >Done</v-btn
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

  submit() {
    if (!this.valid) {
      return;
    }

    this.store
      .createDataset({
        name: this.name,
        description: this.description,
        path: this.path!
      })
      .then(ds => {
        this.dataset = ds;
      });
  }
}
</script>
