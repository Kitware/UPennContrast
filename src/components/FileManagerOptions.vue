<template>
  <v-list class="pa-0" :disabled="disableOptions">
    <!-- Moving -->
    <v-list-item @click.stop="moveDialog = true">
      <v-list-item-title>
        Move
      </v-list-item-title>
    </v-list-item>
    <girder-location-chooser
      :dialog.sync="moveDialog"
      @input="move"
      :disabled="disableOptions"
      activator-disabled
    />
    <!-- Deleting -->
    <v-list-item @click.stop="deleteDialog = true">
      <v-list-item-title>
        Delete
      </v-list-item-title>
    </v-list-item>
    <v-dialog v-model="deleteDialog">
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
    <template v-if="items.length === 1">
      <v-list-item @click.stop="renameDialog = true">
        <v-list-item-title>
          Rename
        </v-list-item-title>
      </v-list-item>
      <v-dialog v-model="renameDialog">
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
    </template>
  </v-list>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import store from "@/store";
import girderResources from "@/store/girderResources";
import { IGirderFolder, IGirderSelectAble } from "@/girder";
import { createDecorator } from "vue-class-component";

const OptionAction = createDecorator((options, key) => {
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
  readonly girderResources = girderResources;

  @Prop()
  items!: IGirderSelectAble[];

  disableOptions: boolean = false;

  moveDialog: boolean = false;

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
    for (const item of this.items) {
      this.girderResources.ressourceChanged(item._id);
    }
    this.$emit("itemsChanged");
    this.disableOptions = false;
  }

  @Watch("items")
  onItemsChanged() {
    if (this.items.length === 1) {
      this.newName = this.items[0].name;
    }
  }

  get openedDialogs() {
    return [this.moveDialog, this.renameDialog, this.deleteDialog];
  }

  get isADialogOpen() {
    return this.openedDialogs.some(dialog => dialog);
  }

  @Watch("isADialogOpen")
  closeMenuOnDialogClose(isOpen: boolean, wasOpen: boolean) {
    if (wasOpen && !isOpen) {
      this.closeMenu();
    }
  }

  closeMenu() {
    this.$emit("closeMenu");
  }

  @OptionAction
  async move(location: IGirderFolder | null) {
    if (!location || !this.items.length) {
      return;
    }
    await this.store.api.moveItems(this.items, location._id);
  }

  @OptionAction
  async rename() {
    if (this.items.length !== 1) {
      return;
    }
    const item = this.items[0];
    await this.store.api.renameItem(item, this.newName);
    this.newName = "";
    this.renameDialog = false;
  }

  @OptionAction
  async deleteItems() {
    await this.store.api.deleteItems(this.items);
    this.deleteDialog = false;
  }
}
</script>
