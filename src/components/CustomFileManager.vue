<template>
  <div>
    <girder-file-manager
      v-if="currentLocation"
      :location.sync="currentLocation"
      new-folder-enabled
      root-location-disabled
      :selectable="menuEnabled"
      v-model="selected"
      v-bind="$attrs"
      v-on="$listeners"
    >
      <template v-if="menuEnabled" #headerwidget>
        <v-menu bottom offset-y>
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              dark
              v-bind="attrs"
              v-on="on"
              :disabled="selected.length === 0"
            >
              Selected Items Actions
              <v-icon>mdi-dots-vertical</v-icon>
            </v-btn>
          </template>
          <v-list class="pa-0">
            <girder-location-chooser
              @input="moveLocation => move(selected, moveLocation)"
              root-location-disabled
              new-folder-enabled
            >
              <template v-slot:activator="{ on }">
                <v-list-item v-on="on">
                  <v-list-item-title>
                    Move
                  </v-list-item-title>
                </v-list-item>
              </template>
            </girder-location-chooser>
          </v-list>
        </v-menu>
      </template>
      <template #row-widget="props">
        {{ renderItem(props.item) }}
        <div class="d-flex flex-wrap">
          <v-chip
            small
            v-for="(chipItem, i) in debouncedChipsPerItemId[props.item._id]"
            :key="'chip ' + i + ' item ' + props.item._id"
            class="ma-1"
            v-bind="chipItem"
            @click.stop
          >
            {{ chipItem.text }}
          </v-chip>
        </div>
        <v-spacer />
        <v-menu v-if="menuEnabled">
          <template v-slot:activator="{ on, attrs }">
            <v-btn dark icon v-bind="attrs" v-on="on">
              <v-icon>mdi-dots-vertical</v-icon>
            </v-btn>
          </template>
          <v-list class="pa-0">
            <girder-location-chooser
              @input="moveLocation => move([props.item], moveLocation)"
              root-location-disabled
              new-folder-enabled
            >
              <template v-slot:activator="{ on }">
                <v-list-item v-on="on">
                  <v-list-item-title>
                    Move
                  </v-list-item-title>
                </v-list-item>
              </template>
            </girder-location-chooser>
          </v-list>
        </v-menu>
      </template>
    </girder-file-manager>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import store from "@/store";
import {
  IGirderFolder,
  IGirderItem,
  IGirderLocation,
  IGirderSelectAble
} from "@/girder";

interface IChipAttrs {
  text: string;
  color: string;
  to?: object;
}

@Component({
  components: {
    GirderLocationChooser: () =>
      import("@/components/GirderLocationChooser.vue").then(mod => mod),
    GirderFileManager: () =>
      import("@/girder/components").then(mod => mod.FileManager)
  }
})
export default class CustomFileManager extends Vue {
  readonly store = store;

  @Prop({
    default: true
  })
  menuEnabled!: boolean;

  @Prop({
    default: true
  })
  viewChipsEnabled!: boolean;

  @Prop({
    default: null
  })
  location!: IGirderLocation | null;

  @Prop({
    default: true
  })
  useDefaultLocation!: boolean;

  defaultLocation: IGirderLocation | null = null;
  chipsPerItemId: { [itemId: string]: IChipAttrs[] } = {};
  debouncedChipsPerItemId: { [itemId: string]: IChipAttrs[] } = {};
  pendingChips: number = 0;
  lastPendingChip: Promise<any> = Promise.resolve();
  knownLocations: { [itemId: string]: IGirderFolder | IGirderItem } = {};
  selected: IGirderSelectAble[] = [];

  get currentLocation() {
    if (this.useDefaultLocation && this.location === null) {
      this.$emit("update:location", this.defaultLocation);
      return this.defaultLocation;
    }
    return this.location;
  }

  set currentLocation(value: IGirderLocation | null) {
    this.$emit("update:location", value);
  }

  mounted() {
    this.fetchLocation();
  }

  get isLoggedIn() {
    return this.store.isLoggedIn;
  }

  @Watch("isLoggedIn")
  async fetchLocation() {
    const publicFolder = await this.store.api.getUserPublicFolder();
    if (publicFolder) {
      this.defaultLocation = publicFolder;
    } else {
      this.defaultLocation = this.store.girderUser;
    }
  }

  renderItem(item: IGirderSelectAble) {
    const isDataset =
      item._modelType === "folder" && item.meta.subtype === "contrastDataset";
    const isConfiguration =
      item._modelType === "item" &&
      item.meta.subtype === "contrastConfiguration";
    if (isDataset) {
      item.icon = "fileMultiple";
    }
    if (isConfiguration) {
      item.icon = "settings";
    }
    if ((isDataset || isConfiguration) && !this.knownLocations[item._id]) {
      this.knownLocations[item._id] = item;
      this.addChipPromise(item);
    }
  }

  addChipPromise(item: IGirderSelectAble) {
    // Chain a new chip promise with last pending promise
    this.lastPendingChip = this.lastPendingChip
      .finally()
      .then(() => this.itemToChips(item))
      .then(chipAttrs => Vue.set(this.chipsPerItemId, item._id, chipAttrs));
    // When done with the last promise, update debouncedChipsPerItemId
    ++this.pendingChips;
    this.lastPendingChip.finally(() => {
      if (--this.pendingChips === 0) {
        this.debouncedChipsPerItemId = { ...this.chipsPerItemId };
      }
    });
  }

  async getItemFromId(id: string, type: "folder" | "item") {
    const knowItem = this.knownLocations[id];
    if (knowItem) {
      return knowItem;
    }
    if (type === "folder") {
      return await this.store.api.getFolder(id);
    } else {
      return await this.store.api.getItem(id);
    }
  }

  move(items: IGirderSelectAble[], location: IGirderFolder | null) {
    if (location) {
      this.store.api.move(items, location._id);
    }
  }

  async itemToChips(item: IGirderSelectAble) {
    const ret: IChipAttrs[] = [];
    const baseChip = {
      color: "blue"
    };
    // Add chips if item is a dataset
    if (
      item._modelType === "folder" &&
      item.meta.subtype === "contrastDataset"
    ) {
      // Dataset chip
      ret.push({ text: "Dataset", color: "green" });
      // A chip per view
      if (this.viewChipsEnabled) {
        const views = await this.store.api.findDatasetViews({
          datasetId: item._id
        });
        await Promise.all(
          views.map(view => {
            this.getItemFromId(view.configurationId, "item").then(configInfo =>
              ret.push({
                ...baseChip,
                text: configInfo.name,
                to: {
                  name: "datasetview",
                  params: {
                    datasetViewId: view.id
                  }
                }
              })
            );
          })
        );
      }
    }
    // Add chips if item is a configuration
    if (
      item._modelType === "item" &&
      item.meta.subtype === "contrastConfiguration"
    ) {
      // Configuration chip
      ret.push({ text: "Configuration", color: "green" });
      // A chip per view
      if (this.viewChipsEnabled) {
        const views = await this.store.api.findDatasetViews({
          configurationId: item._id
        });
        await Promise.all(
          views.map(view => {
            this.getItemFromId(view.datasetId, "folder").then(datasetInfo =>
              ret.push({
                ...baseChip,
                text: datasetInfo.name,
                to: {
                  name: "datasetview",
                  params: {
                    datasetViewId: view.id
                  }
                }
              })
            );
          })
        );
      }
    }
    return ret;
  }
}
</script>
