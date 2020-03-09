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

interface FileUpload {
  file: File;
}

type GWCUpload = Vue & {
  startUpload(): any;
};

function basename(filename: string): string {
  const components = filename.split(".");
  return components.length > 1
    ? components.slice(0, -1).join(".")
    : components[0];
}

function findCommonPrefix(strings: string[]): string {
  // Handle special cases
  if (strings.length === 0) {
    return "";
  } else if (strings.length === 1) {
    return strings[0];
  }

  // Get the minimum length of all the strings; the common prefix cannot be
  // longer than this.
  const minLength = strings.reduce(
    (acc, cur) => Math.min(acc, cur.length),
    Infinity
  );

  // Sweep through the first string, and compare the letter found in each
  // position with the letter at that position for all the strings. Stop when an
  // inequality occurs.
  let result = [];
  for (let i = 0; i < minLength; i++) {
    const ch = strings[0].charAt(i);

    if (!strings.map(s => s.charAt(i)).every(c => c === ch)) {
      break;
    }
    result.push(ch);
  }

  return result.join("");
}

@Component({
  components: {
    GirderLocationChooser,
    GirderUpload: () => import("@/girder/components").then(mod => mod.Upload)
  }
})
export default class NewDataset extends Vue {
  readonly store = store;

  valid = false;
  files = [] as FileUpload[];
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

  get filesSelected() {
    return this.files.length > 0;
  }

  get recommendedName() {
    const { files } = this;

    // If there aren't any files selected yet, return a blank string.
    if (files.length === 0) {
      return "";
    }

    // If there is only one file, return its name with the extension struck off.
    if (files.length === 1) {
      return basename(files[0].file.name);
    }

    // For more than one file, search for the longest prefix common to all, and
    // use that as the name if it's nonblank; otherwise use the name of the
    // first file.
    const prefix = findCommonPrefix(files.map(d => d.file.name));
    if (prefix.length > 0) {
      return prefix;
    } else {
      return basename(files[0].file.name);
    }
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

    this.path = this.dataset!._girder;

    await Vue.nextTick();

    (this.$refs.uploader as GWCUpload).startUpload();
  }

  filesChanged(files: FileUpload[]) {
    this.files = files;

    if (this.name === "" && files.length > 0) {
      this.name = this.recommendedName;
    }
  }
}
</script>
