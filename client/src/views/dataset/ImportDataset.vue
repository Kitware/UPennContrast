<template>
  <v-container>
    <v-form v-model="valid">
      <v-text-field
        :value="pathName"
        label="Path"
        readonly
        required
        :error-messages="errorMessages"
        :success-messages="successMessages"
        placeholder="Choose folder with images..."
        :rules="rules"
      >
        <template #append>
          <girder-location-chooser
            v-model="path"
            title="Select a Folder with Images"
          />
        </template>
      </v-text-field>

      <div class="button-bar">
        <v-btn :disabled="!valid" color="success" class="mr-4" @click="submit"
          >Import</v-btn
        >
      </div>
    </v-form>
  </v-container>
</template>
<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import store from "@/store";
import { IGirderSelectAble } from "@/girder";
import GirderLocationChooser from "@/components/GirderLocationChooser.vue";
import { IDataset } from "@/store/model";

@Component({
  components: {
    GirderLocationChooser
  }
})
export default class NewDataset extends Vue {
  readonly store = store;

  valid = false;
  path: IGirderSelectAble | null = null;
  errorMessages: string[] = [];
  successMessages: string[] = [];

  get pathName() {
    return this.path ? this.path.name : "";
  }

  get rules() {
    return [(v: string) => v.trim().length > 0 || `value is required`];
  }

  @Watch("path")
  onPathChange(value: IGirderSelectAble | null) {
    this.errorMessages = [];
    this.successMessages = [];

    if (value) {
      this.store.api
        .getImages(value._id)
        .then(images => {
          if (images.length > 0) {
            this.successMessages.push(
              `Detected ${images.length} ${
                images.length > 1 ? "images" : "image"
              }`
            );
          } else {
            this.errorMessages.push(`No contained images detected`);
          }
        })
        .catch(error => {
          this.errorMessages.push(
            `Cannot resolve number of contained images: ${error}`
          );
        });
    }
  }

  submit() {
    if (!this.valid) {
      return;
    }

    this.store.importDataset(this.path!).then(ds => {
      if (ds) {
        this.$router.push({
          name: "dataset",
          params: { id: ds.id }
        });
      }
    });
  }
}
</script>
