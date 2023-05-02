<template>
  <v-dialog v-model="open" scrollable width="auto">
    <template #activator="{ on }">
      <div class="d-flex">
        <slot name="activator" v-bind="{ on }">
          <v-btn v-on="on">
            Choose...
          </v-btn>
        </slot>
        <girder-breadcrumb
          v-if="breadcrumb && selected"
          class="pl-4"
          root-location-disabled
          :location="selected"
        />
      </div>
    </template>
    <v-card class="pa-2" style="min-width: 70vh;">
      <v-card-title>{{ title }}</v-card-title>
      <v-card-text style="height: 70vh;">
        <custom-file-manager
          :location.sync="selected"
          v-bind="$attrs"
          :initial-items-per-page="-1"
          :items-per-page-options="[-1]"
          :menu-enabled="false"
          :view-chips-enabled="false"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click.prevent="open = false" color="warning">
          Cancel
        </v-btn>
        <v-btn @click.prevent="select" :disabled="!selected" color="primary">
          Select
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import store from "@/store";
import { IGirderSelectAble } from "@/girder";
import CustomFileManager from "@/components/CustomFileManager.vue";

@Component({
  components: {
    CustomFileManager,
    GirderBreadcrumb: () =>
      import("@/girder/components").then(mod => mod.Breadcrumb)
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
  breadcrumb!: boolean;

  open = false;

  selected: IGirderSelectAble | null = null;

  mounted() {
    this.valueChanged();
  }

  @Watch("value")
  valueChanged() {
    this.selected = this.value;
  }

  get selectedName() {
    return this.selected ? this.selected.name : "Select a folder...";
  }

  select() {
    this.open = false;
    this.$emit("input", this.selected);
  }
}
</script>
