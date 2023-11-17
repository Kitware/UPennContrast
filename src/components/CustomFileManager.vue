<template>
  <div class="custom-file-manager-wrapper">
    <div class="d-flex align-center ma-2">
      <v-icon class="mr-2">mdi-magnify</v-icon>
      <div class="flex-grow-1">
        <girder-search @select="searchInput" hide-search-icon>
          <template #searchresult="item">
            {{ renderItem(item) }}
            <v-icon class="mr-2">{{ iconToMdi(iconFromItem(item)) }}</v-icon>
            {{ item.name }}
            <div class="d-flex flex-wrap">
              <v-chip
                small
                v-for="(chipItem, i) in debouncedChipsPerItemId[item._id]"
                :key="'chip ' + i + ' item ' + item._id"
                class="ma-1"
                v-bind="chipItem"
                @click.stop
              >
                {{ chipItem.text }}
              </v-chip>
            </div>
          </template>
        </girder-search>
      </div>
    </div>
    <girder-file-manager
      v-if="currentLocation"
      :location.sync="currentLocation"
      new-folder-enabled
      :selectable="menuEnabled || selectable"
      v-model="selected"
      v-bind="$attrs"
      v-on="$listeners"
    >
      <template v-if="menuEnabled" #headerwidget>
        <v-menu v-model="selectedItemsOptionsMenu" bottom offset-y>
          <template v-slot:activator="{ on, attrs }">
            <v-btn v-bind="attrs" v-on="on" :disabled="selected.length === 0">
              Selected Items Actions
              <v-icon>mdi-dots-vertical</v-icon>
            </v-btn>
          </template>
          <file-manager-options
            @itemsChanged="reloadItems"
            @closeMenu="selectedItemsOptionsMenu = false"
            :items="selected"
          />
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
        <v-menu v-model="rowOptionsMenu[props.item._id]" v-if="menuEnabled">
          <template v-slot:activator="{ on, attrs }">
            <v-btn icon v-bind="attrs" v-on="on">
              <v-icon>mdi-dots-vertical</v-icon>
            </v-btn>
          </template>
          <file-manager-options
            @itemsChanged="reloadItems"
            :items="[props.item]"
            @closeMenu="rowOptionsMenu[props.item._id] = false"
          />
        </v-menu>
      </template>
    </girder-file-manager>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import store from "@/store";
import girderResources from "@/store/girderResources";
import { IGirderLocation, IGirderSelectAble } from "@/girder";
import {
  isConfigurationItem,
  isDatasetFolder,
  toConfigurationItem,
  toDatasetFolder
} from "@/utils/girderSelectable";
import { RawLocation } from "vue-router";
import FileManagerOptions from "./FileManagerOptions.vue";
import { Search as GirderSearch } from "@/girder/components";
import { vuetifyConfig } from "@/girder";

interface IChipAttrs {
  text: string;
  color: string;
  to?: RawLocation;
}

@Component({
  components: {
    FileManagerOptions,
    GirderSearch,
    GirderFileManager: () =>
      import("@/girder/components").then(mod => mod.FileManager)
  }
})
export default class CustomFileManager extends Vue {
  readonly store = store;
  readonly girderResources = girderResources;

  @Prop({
    default: true
  })
  menuEnabled!: boolean;

  @Prop({
    default: false
  })
  selectable!: boolean;

  @Prop({
    default: true
  })
  moreChips!: boolean;

  @Prop({
    default: true
  })
  clickableChips!: boolean;

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
  computedChipsIds: Set<string> = new Set();
  selected: IGirderSelectAble[] = [];

  selectedItemsOptionsMenu: boolean = false;
  rowOptionsMenu: { [itemId: string]: boolean } = {};

  async reloadItems() {
    const location = this.currentLocation;
    this.currentLocation = { type: "root" };
    await Vue.nextTick();
    this.currentLocation = location;
  }

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
    this.defaultLocation = publicFolder || this.store.girderUser;
  }

  @Watch("selected")
  @Watch("selectable")
  emitSelected() {
    if (this.selectable) {
      this.$emit("selected", this.selected);
    }
  }

  searchInput(value: IGirderSelectAble) {
    if (value._modelType === "item" || value._modelType === "file") {
      return;
    }
    this.currentLocation = value;
    this.$emit("rowclick", value);
  }

  iconToMdi(icon: string) {
    return vuetifyConfig.icons.values[icon] || `mdi-${icon}`;
  }

  iconFromItem(selectable: IGirderSelectAble) {
    if (isDatasetFolder(selectable)) {
      return "fileMultiple";
    }
    if (isConfigurationItem(selectable)) {
      return "settings";
    }
    switch (selectable._modelType) {
      case "file":
      case "item":
        return "file";
      case "folder":
        return "folder";
      case "user":
        return "user";
    }
  }

  renderItem(selectable: IGirderSelectAble) {
    const datasetFolder = toDatasetFolder(selectable);
    const configurationItem = toConfigurationItem(selectable);
    selectable.icon = this.iconFromItem(selectable);
    const folderOrItem = datasetFolder || configurationItem;
    if (folderOrItem && !this.computedChipsIds.has(selectable._id)) {
      this.computedChipsIds.add(selectable._id);
      this.addChipPromise(selectable);
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

  async itemToChips(selectable: IGirderSelectAble) {
    const ret: IChipAttrs[] = [];
    const baseChip = {
      color: "blue"
    };
    // Add chips if item is a dataset
    if (isDatasetFolder(selectable)) {
      // Dataset chip
      const firstChip: IChipAttrs = {
        text: "Dataset",
        color: "green"
      };
      if (this.clickableChips) {
        firstChip.to = {
          name: "dataset",
          params: { datasetId: selectable._id }
        };
      }
      ret.push(firstChip);
      // A chip per view
      if (this.moreChips) {
        const views = await this.store.api.findDatasetViews({
          datasetId: selectable._id
        });
        await Promise.all(
          views.map(view => {
            this.girderResources
              .getItem(view.configurationId)
              .then(configInfo => {
                if (!configInfo) {
                  return;
                }
                const newChip: IChipAttrs = {
                  ...baseChip,
                  text: configInfo.name
                };
                if (this.clickableChips) {
                  newChip.to = {
                    name: "configuration",
                    params: {
                      configurationId: view.configurationId
                    }
                  };
                }
                ret.push(newChip);
              });
          })
        );
      }
    }
    // Add chips if item is a configuration
    if (isConfigurationItem(selectable)) {
      // Configuration chip
      const firstChip: IChipAttrs = {
        text: "Configuration",
        color: "green"
      };
      if (this.clickableChips) {
        firstChip.to = {
          name: "configuration",
          params: { configurationId: selectable._id }
        };
      }
      ret.push(firstChip);
      // A chip per view
      if (this.moreChips) {
        const views = await this.store.api.findDatasetViews({
          configurationId: selectable._id
        });
        await Promise.all(
          views.map(view => {
            this.girderResources.getFolder(view.datasetId).then(datasetInfo => {
              if (!datasetInfo) {
                return;
              }
              const newChip: IChipAttrs = {
                ...baseChip,
                text: datasetInfo.name
              };
              if (this.clickableChips) {
                newChip.to = {
                  name: "dataset",
                  params: {
                    datasetId: view.datasetId
                  }
                };
              }
              ret.push(newChip);
            });
          })
        );
      }
    }
    return ret;
  }
}
</script>

<style lang="scss">
.custom-file-manager-wrapper,
.custom-file-manager-wrapper > .girder-data-browser-snippet,
.custom-file-manager-wrapper
  > .girder-data-browser-snippet
  > .girder-file-browser,
.custom-file-manager-wrapper
  > .girder-data-browser-snippet
  > .girder-file-browser
  > .v-data-table__wrapper {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.custom-file-manager-wrapper
  > .girder-data-browser-snippet
  > .girder-file-browser
  > .v-data-table__wrapper {
  overflow-y: auto;
}
</style>
