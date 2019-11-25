<template>
  <v-container>
    <v-form v-model="valid">
      <v-text-field v-model="name" label="Name" required :rules="rules" />
      <v-textarea v-model="description" label="Description" />
      <v-text-field
        :value="pathName"
        label="Path"
        readonly
        required
        placeholder="Choose Folder..."
        :rules="rules"
      >
        <template #append>
          <girder-location-chooser v-model="path" />
        </template>
      </v-text-field>

      <!-- Upload Area -->

      <v-btn :disabled="!valid" color="success" class="mr-4" @click="submit">
        Create
      </v-btn>
    </v-form>
  </v-container>
</template>
<script lang="ts">
import { Vue, Component, Inject, Prop } from "vue-property-decorator";
import store from "@/store";
import { IGirderSelectAble } from "../../girder";
import GirderLocationChooser from "@/components/GirderLocationChooser.vue";

@Component({
  components: {
    GirderLocationChooser
  }
})
export default class NewDataset extends Vue {
  readonly store = store;

  valid = false;
  name = "";
  description = "";

  path: IGirderSelectAble | null = null;

  get pathName() {
    return this.path ? this.path.name : "";
  }

  get rules() {
    return [(v: string) => v.trim().length > 0 || `value is required`];
  }

  submit() {
    if (!this.valid) {
      return;
    }

    // TODO create dataset for real
  }
}
</script>
