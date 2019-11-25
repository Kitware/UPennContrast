<template>
  <v-dialog v-model="open" max-width="33vw">
    <template #activator="{ on }">
      <v-btn v-on="on">
        Choose...
      </v-btn>
    </template>
    <v-card>
      <v-card-title>Item Chooser</v-card-title>
      <v-card-text>
        <girder-file-manager @rowclick="onRowClick" :location="value" />
      </v-card-text>
      <v-card-actions>
        <div class="grow">{{ selectedName }}</div>
        <v-btn @click.prevent="select" :disabled="!selected">Select</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { Vue, Component, Inject, Prop } from "vue-property-decorator";
import store from "@/store";
import { FileManager as GirderFileManager } from "@/girder";
import { IGirderLocation, IGirderSelectAble } from "@girder/components/src";

@Component({
  components: {
    GirderFileManager
  }
})
export default class GirderLocationChooser extends Vue {
  readonly store = store;

  @Prop()
  value!: IGirderSelectAble | null;

  @Prop({
    default: false
  })
  chooseItem!: boolean;

  open = false;

  selected: IGirderSelectAble | null = this.value;

  get selectedName() {
    return this.selected ? this.selected.name : "Select...";
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
}
</script>

<style lang="scss" scoped>
.grow {
  flex: 1 1 0;
}
</style>