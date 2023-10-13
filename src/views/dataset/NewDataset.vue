<template>
  <v-container>
    <v-form ref="form" v-model="valid">
      <girder-upload
        v-if="path && !hideUploader"
        ref="uploader"
        :dest="path"
        hideStartButton
        hideHeadline
        @filesChanged="filesChanged"
        @done="nextStep"
        @error="interruptedUpload"
        @hook:mounted="uploadMounted"
      >
        <template #dropzone="{ inputFilesChanged }">
          <file-dropzone @input="inputFilesChanged" style="height: 260px;" />
        </template>
      </girder-upload>

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

      <v-card>
        <v-card-title>Location:</v-card-title>
        <v-card-text>
          <v-container>
            <v-row>
              <girder-location-chooser
                v-model="path"
                :breadcrumb="true"
                title="Select a Folder to Import the New Dataset"
              />
            </v-row>
          </v-container>
        </v-card-text>
      </v-card>

      <div class="button-bar">
        <v-btn
          :disabled="!valid || !filesSelected || uploading"
          color="success"
          class="mr-4"
          @click="submit"
          >Upload
        </v-btn>
      </div>
    </v-form>

    <v-alert v-if="failedDataset" text type="error">
      Could not create dataset <strong>{{ failedDataset }}</strong
      >. This might happen, for instance, if a dataset by that name already
      exists. Please update the dataset name field and try again.
    </v-alert>
  </v-container>
</template>
<script lang="ts">
import { Vue, Component, VModel, Prop } from "vue-property-decorator";
import store from "@/store";
import girderResources from "@/store/girderResources";
import { IGirderSelectAble } from "@/girder";
import GirderLocationChooser from "@/components/GirderLocationChooser.vue";
import FileDropzone from "@/components/Files/FileDropzone.vue";
import { IDataset } from "@/store/model";
import { triggers, makeAlternation } from "@/utils/parsing";
import { formatDate } from "@/utils/date";

interface FileUpload {
  file: File;
}

type GWCUpload = Vue & {
  inputFilesChanged(files: File[]): void;
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

  // Extract the non-metadata prefix of each filename. Note that because of the
  // way the regex is constructed, the first match group will never be `null`.
  const re = new RegExp(`(.*?)(?:_|-|${makeAlternation(triggers)})`);
  const matches = strings.map(s => s.match(re)![1]);

  // Get the minimum length of all the strings; the common prefix cannot be
  // longer than this.
  const minLength = matches.reduce(
    (acc, cur) => Math.min(acc, cur.length),
    Infinity
  );

  // Sweep through the first string, and compare the letter found in each
  // position with the letter at that position for all the strings. Stop when an
  // inequality occurs.
  let result = [];
  for (let i = 0; i < minLength; i++) {
    const ch = matches[0].charAt(i);

    if (!matches.map(s => s.charAt(i)).every(c => c === ch)) {
      break;
    }
    result.push(ch);
  }

  return result.join("");
}

@Component({
  components: {
    GirderLocationChooser,
    FileDropzone,
    GirderUpload: () => import("@/girder/components").then(mod => mod.Upload)
  }
})
export default class NewDataset extends Vue {
  readonly store = store;
  readonly girderResources = girderResources;

  @VModel({ type: Array, default: () => [] })
  files!: File[];

  @Prop({ default: false })
  readonly quickupload!: boolean;

  valid = false;
  failedDataset = "";
  uploading = false;
  hideUploader = false;
  name = "";
  description = "";

  path: IGirderSelectAble | null = null;

  dataset: IDataset | null = null;

  $refs!: {
    uploader?: GWCUpload;
    form: HTMLFormElement;
  };

  get pageTwo() {
    return this.dataset != null;
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
      return basename(files[0].name);
    }

    // For more than one file, search for the longest prefix common to all, and
    // use that as the name if it's nonblank; otherwise use the name of the
    // first file.
    const prefix = findCommonPrefix(files.map(d => d.name));
    if (prefix.length > 0) {
      return prefix;
    } else {
      return basename(files[0].name);
    }
  }

  async mounted() {
    const publicFolder = await this.store.api.getUserPublicFolder();
    if (!publicFolder) {
      return;
    }
    if (this.quickupload) {
      this.path = await this.store.api.getQuickUploadFolder(publicFolder._id);
    } else {
      this.path = publicFolder;
    }
  }

  async uploadMounted() {
    this.$refs.uploader?.inputFilesChanged(this.files);
    if (this.quickupload) {
      this.name = formatDate(new Date()) + " - " + this.recommendedName;
      await Vue.nextTick(); // "name" prop is set in the form
      await Vue.nextTick(); // this.valid is updated
      this.submit();
    }
  }

  async submit() {
    if (!this.valid || !this.path) {
      return;
    }

    this.dataset = await this.store.createDataset({
      name: this.name,
      description: this.description,
      path: this.path
    });

    if (this.dataset === null) {
      this.failedDataset = this.name;
      return;
    }

    this.failedDataset = "";

    this.path = await this.girderResources.getFolder(this.dataset.id);
    await Vue.nextTick();

    this.uploading = true;
    this.$refs.uploader!.startUpload();
  }

  filesChanged(files: FileUpload[]) {
    this.files = files.map(({ file }) => file);

    if (this.name === "" && files.length > 0) {
      this.name = this.recommendedName;
    }
  }

  interruptedUpload() {
    this.uploading = false;
    this.hideUploader = false;
  }

  nextStep() {
    this.hideUploader = true;

    this.$router.push({
      name: "multi",
      params: {
        datasetId: this.dataset!.id,
        quickupload: this.quickupload
      } as any
    });
  }
}
</script>
