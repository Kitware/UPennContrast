<template>
  <v-dialog v-model="open" max-width="50vw">
    <template #activator="{ on }">
      <v-btn v-on="on">
        Choose...
      </v-btn>
    </template>
    <v-card>
      <v-card-title>{{ title }}</v-card-title>
      <v-card-text>
        <girder-file-manager
          @rowclick="onRowClick"
          :location="value"
          :new-folder-enabled="allowNewFolder"
          :initial-items-per-page="itemsPerPage"
          :items-per-page-options="itemsPerPageOptions"
        />
      </v-card-text>
      <v-card-actions>
        <div class="grow">{{ selectedName }}</div>
        <v-btn @click.prevent="select" :disabled="!selected">Select</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import store from "@/store";
import { IGirderLocation, IGirderSelectAble } from "@/girder";

@Component({
  components: {
    GirderFileManager: () =>
      import("@/girder/components").then(mod => mod.FileManager)
  }
})
export default class GirderLocationChooser extends Vue {
  readonly store = store;

  @Prop()
  value!: IGirderSelectAble | null;

  @Prop({
    default: "Select a Folder"
  })
  title!: string;

  @Prop({
    default: false
  })
  chooseItem!: boolean;

  @Prop({
    default: false
  })
  allowNewFolder!: boolean;

  open = false;

  selected: IGirderSelectAble | null = this.value;

  get selectedName() {
    return this.selected ? this.selected.name : "Select a folder...";
  }

  select() {
    this.open = false;
    this.$emit("input", this.selected);
  }

  onRowClick(data: IGirderSelectAble) {
    if ((data._modelType === "item") === this.chooseItem) {
      this.selected = data;
    }
  }

  data() {
    return {
      itemsPerPage: 100,
      itemsPerPageOptions: [10, 20, 50, 100, -1]
    };
  }
}
</script>
