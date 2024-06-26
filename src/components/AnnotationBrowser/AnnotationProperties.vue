<template>
  <v-expansion-panel>
    <v-expansion-panel-header>Properties</v-expansion-panel-header>
    <v-expansion-panel-content>
      <v-container fluid class="pa-0">
        <v-row class="mb-2">
          <v-col>
            <v-text-field
              v-model="propFilter"
              label="Filter properties"
              single-line
              clearable
              dense
              @click:clear="clearFilter"
              @input="filterProperties"
            ></v-text-field>
          </v-col>
        </v-row>
        <div class="miller-columns-container">
          <div class="miller-columns-scroll">
            <div
              class="miller-column"
              v-for="(column, colIndex) in columns"
              :key="colIndex"
            >
              <v-list dense>
                <v-list-item
                  v-for="item in column"
                  :key="item.path.join('.')"
                  @click="selectItem(item, colIndex)"
                  :class="{ 'v-list-item--active': isSelected(item, colIndex) }"
                >
                  <v-list-item-content>
                    <v-list-item-title>
                      {{ item.name }}
                    </v-list-item-title>
                  </v-list-item-content>
                  <v-list-item-icon v-if="!isLeaf(item)" class="mr-2">
                    <v-icon small>mdi-chevron-right</v-icon>
                  </v-list-item-icon>
                  <template v-if="isLeaf(item)">
                    <v-list-item-action>
                      <v-checkbox
                        dense
                        hide-details
                        :input-value="isPropertyDisplayed(item.path)"
                        @click.stop="toggleList(item.path)"
                      />
                    </v-list-item-action>
                    <v-list-item-action>
                      <v-checkbox
                        dense
                        hide-details
                        :input-value="isPropertyFiltered(item.path)"
                        @click.stop="toggleFilter(item.path)"
                      />
                    </v-list-item-action>
                  </template>
                </v-list-item>
              </v-list>
            </div>
          </div>
        </div>
      </v-container>
    </v-expansion-panel-content>
  </v-expansion-panel>
</template>

<script lang="ts">
import { Vue, Component, Watch } from "vue-property-decorator";
import propertyStore from "@/store/properties";
import filterStore from "@/store/filters";
import { findIndexOfPath } from "@/utils/paths";

interface PropertyItem {
  name: string;
  path: string[];
  children?: PropertyItem[];
}

@Component
export default class AnnotationProperties extends Vue {
  readonly propertyStore = propertyStore;
  readonly filterStore = filterStore;
  readonly findIndexOfPath = findIndexOfPath;

  propFilter: string = "";
  columns: PropertyItem[][] = [];
  selectedItems: PropertyItem[] = [];

  mounted() {
    this.initializeColumns();
  }

  @Watch("propertyStore.computedPropertyPaths")
  onComputedPropertyPathsChange() {
    this.initializeColumns();
  }

  initializeColumns() {
    if (this.propertyStore.computedPropertyPaths.length > 0) {
      const rootItems = this.buildPropertyTree(
        this.propertyStore.computedPropertyPaths,
      );
      this.columns = [rootItems];
    }
  }

  buildPropertyTree(paths: string[][]): PropertyItem[] {
    const tree: PropertyItem[] = [];
    paths.forEach((path) => {
      let currentLevel = tree;
      path.forEach((segment, index) => {
        let existingItem: PropertyItem | undefined;
        let itemName: string;

        if (index === 0) {
          // Handle root level
          const property = this.propertyStore.getPropertyById(segment);
          itemName = property ? property.name : segment; // Fallback to segment if property not found
        } else {
          // Handle subsequent levels
          itemName = segment;
        }

        existingItem = currentLevel.find((item) => item.name === itemName);
        if (!existingItem) {
          existingItem = {
            name: itemName,
            path: path.slice(0, index + 1),
            children: [],
          };
          currentLevel.push(existingItem);
        }

        currentLevel = existingItem.children!;
      });
    });
    return tree;
  }

  selectItem(item: PropertyItem, columnIndex: number) {
    this.selectedItems = this.selectedItems.slice(0, columnIndex);
    this.selectedItems.push(item);
    this.columns = this.columns.slice(0, columnIndex + 1);
    if (item.children && item.children.length > 0) {
      this.columns.push(item.children);
    }
  }

  isSelected(item: PropertyItem, columnIndex: number): boolean {
    return this.selectedItems[columnIndex] === item;
  }

  isLeaf(item: PropertyItem): boolean {
    return !item.children || item.children.length === 0;
  }

  getTagsForPath(path: string[]) {
    const property = this.propertyStore.getPropertyById(path[0]);
    return property?.tags.tags || [];
  }

  isPropertyDisplayed(path: string[]): boolean {
    return (
      this.findIndexOfPath(path, this.propertyStore.displayedPropertyPaths) >= 0
    );
  }

  isPropertyFiltered(path: string[]): boolean {
    return this.findIndexOfPath(path, this.filterStore.filterPaths) >= 0;
  }

  toggleList(propertyPath: string[]) {
    this.propertyStore.togglePropertyPathVisibility(propertyPath);
  }

  toggleFilter(propertyPath: string[]) {
    this.filterStore.togglePropertyPathFiltering(propertyPath);
  }

  clearFilter() {
    this.propFilter = "";
    this.initializeColumns();
  }

  filterProperties() {
    if (!this.propFilter) {
      this.initializeColumns();
      return;
    }
    const filteredPaths = this.propertyStore.computedPropertyPaths.filter(
      (path) => {
        const fullName = this.propertyStore.getFullNameFromPath(path);
        return (
          fullName !== null &&
          fullName.toLowerCase().includes(this.propFilter.toLowerCase())
        );
      },
    );
    this.columns = [this.buildPropertyTree(filteredPaths)];
    this.selectedItems = [];
  }
}
</script>

<style scoped>
.v-list-item--active {
  background-color: rgba(0, 0, 0, 0.12);
}

.v-list-item__icon {
  margin-right: 8px !important;
}

.miller-columns-container {
  position: relative;
  overflow: hidden;
  width: 100%;
}

.miller-columns-scroll {
  display: flex;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.3) transparent;
}

.miller-column {
  flex: 0 1 auto; /* Changed from flex: 0 0 auto */
  min-width: 150px; /* Minimum width */
  max-width: 300px; /* Maximum width */
  padding-right: 1px;
  border-right: 1px solid rgba(0, 0, 0, 0.12);
}

.v-list-item__content {
  overflow: hidden;
}

.v-list-item__title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* For Webkit browsers like Chrome/Safari */
.miller-columns-scroll::-webkit-scrollbar {
  height: 8px;
}

.miller-columns-scroll::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.miller-columns-scroll::-webkit-scrollbar-track {
  background-color: transparent;
}
</style>
