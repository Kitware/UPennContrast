<template>
  <v-dialog v-model="showDialog" width="50%">
    <v-card>
      <v-card-title>
        Add tags to or remove tags from selected objects
      </v-card-title>
      <tag-picker class="ma-4 pa-4" v-model="localTags"></tag-picker>
      <v-radio-group v-model="localAddOrRemove" row class="ma-4">
        <v-radio label="Add tags to selected objects" value="add"></v-radio>
        <v-radio
          label="Remove tags from selected objects"
          value="remove"
        ></v-radio>
      </v-radio-group>
      <v-checkbox
        v-model="localReplaceExisting"
        label="Replace existing tags"
        class="ma-4"
        :disabled="localAddOrRemove === 'remove'"
      ></v-checkbox>
      <v-divider></v-divider>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="warning" @click="clearTags"> Clear input </v-btn>
        <v-btn color="primary" @click="submit"> Add/remove tags </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import TagPicker from "@/components/TagPicker.vue";

@Component({
  components: { TagPicker },
})
export default class TagSelectionDialog extends Vue {
  @Prop({ type: Boolean, required: true })
  show!: boolean;

  localTags: string[] = [];
  localAddOrRemove: "add" | "remove" = "add";
  localReplaceExisting: boolean = false;

  get showDialog() {
    return this.show;
  }

  set showDialog(value: boolean) {
    this.$emit("update:show", value);
  }

  clearTags() {
    this.localTags = [];
  }

  submit() {
    this.$emit("submit", {
      tags: this.localTags,
      addOrRemove: this.localAddOrRemove,
      replaceExisting: this.localReplaceExisting,
    });
    this.clearTags();
    this.localAddOrRemove = "add";
    this.localReplaceExisting = false;
    this.showDialog = false;
  }
}
</script>
