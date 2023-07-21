<template>
  <v-list class="pa-0" :disabled="disableOptions">
    <!-- Moving -->
    <girder-location-chooser @input="move" :disabled="disableOptions">
      <template v-slot:activator="{ on }">
        <v-list-item v-on="on">
          <v-list-item-title>
            Move
          </v-list-item-title>
        </v-list-item>
      </template>
    </girder-location-chooser>
    <!-- Deleting -->
    <v-dialog v-model="deleteDialog">
      <template v-slot:activator="{ on }">
        <v-list-item v-on="on">
          <v-list-item-title>
            Delete
          </v-list-item-title>
        </v-list-item>
      </template>
      <v-card>
        <v-card-title>
          Delete items
        </v-card-title>
        <v-card-text>
          You are about to delete these items:<br />
          {{ items.map(({ name }) => name).join(", ") }}
        </v-card-text>
        <v-card-actions class="d-flex">
          <v-spacer />
          <v-btn color="red" @click="deleteItems" :disabled="disableOptions">
            Delete
          </v-btn>
          <v-btn
            color="primary"
            @click="deleteDialog = false"
            :disabled="disableOptions"
          >
            Cancel
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <!-- Renaming -->
    <v-dialog v-model="renameDialog" v-if="items.length === 1">
      <template v-slot:activator="{ on }">
        <v-list-item v-on="on">
          <v-list-item-title>
            Rename
          </v-list-item-title>
        </v-list-item>
      </template>
      <v-card>
        <v-card-title>
          New name
        </v-card-title>
        <v-card-text>
          <v-form @submit="rename">
            <v-text-field v-model="newName" autofocus />
            <div class="d-flex">
              <v-spacer />
              <v-btn type="submit" color="primary" :disabled="disableOptions">
                Submit
              </v-btn>
            </div>
          </v-form>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-list>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import store from "@/store";
import { IGirderFolder, IGirderSelectAble } from "@/girder";
import { createDecorator } from "vue-class-component";

const Action = createDecorator((options, key) => {
  const methods = options.methods;
  if (!methods) {
    return;
  }
  // Keep the original method for later.
  const originalMethod = methods[key];
  const beforeAction = methods.beforeAction;
  const afterAction = methods.afterAction;

  // Wrap the method with the logging logic.
  methods[key] = async function wrapperMethod(...args) {
    try {
      beforeAction?.apply(this, args);
      return await originalMethod.apply(this, args);
    } finally {
      afterAction?.apply(this, args);
    }
  };
});

@Component({
  components: {
    GirderLocationChooser: () =>
      import("@/components/GirderLocationChooser.vue").then(mod => mod)
  }
})
export default class FileManagerOptions extends Vue {
  readonly store = store;

  @Prop()
  items!: IGirderSelectAble[];

  disableOptions: boolean = false;

  renameDialog: boolean = false;
  newName: string = "";

  deleteDialog: boolean = false;

  mounted() {
    this.onItemsChanged();
  }

  beforeAction() {
    this.disableOptions = true;
  }

  afterAction() {
    this.$emit("itemsChanged");
    this.disableOptions = false;
  }

  @Watch("items")
  onItemsChanged() {
    if (this.items.length === 1) {
      this.newName = this.items[0].name;
    }
  }

  @Action
  async move(location: IGirderFolder | null) {
    if (!location || !this.items.length) {
      return;
    }
    await this.store.api.moveItems(this.items, location._id);
  }

  @Action
  async rename() {
    if (this.items.length !== 1) {
      return;
    }
    const item = this.items[0];
    await this.store.api.renameItem(item, this.newName);
    this.newName = "";
    this.renameDialog = false;
  }

  @Action
  async deleteItems() {
    await this.store.api.deleteItems(this.items);
    this.deleteDialog = false;
  }
}
</script>
