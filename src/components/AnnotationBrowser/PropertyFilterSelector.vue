<template>
  <v-dialog v-model="dialog" max-width="500px">
    <template v-slot:activator="{ on, attrs }">
      <v-btn v-bind="attrs" v-on="on" class="filter-element" small>
        Add property value filter
      </v-btn>
    </template>
    <v-card>
      <v-card-title>Filter by properties</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="searchQuery"
          label="Search properties"
          clearable
          dense
          single-line
        />
        <v-list dense>
          <v-list-item
            v-for="propertyPath in filteredPropertyPaths"
            :key="propertyPath.join('.')"
          >
            <v-list-item-action>
              <v-checkbox
                :input-value="isPropertyPathFiltered(propertyPath)"
                @change="togglePropertyPathFiltering(propertyPath)"
                dense
                hide-details
              />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>
                {{ getPropertyFullName(propertyPath) }}
              </v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text @click="dialog = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import filterStore from "@/store/filters";
import propertyStore from "@/store/properties";

@Component
export default class PropertyFilterSelector extends Vue {
  readonly filterStore = filterStore;
  readonly propertyStore = propertyStore;

  dialog = false;
  searchQuery = "";

  get allPropertyPaths() {
    return this.propertyStore.computedPropertyPaths;
  }

  get filteredPropertyPaths() {
    const query = this.searchQuery.toLowerCase();
    return this.allPropertyPaths.filter((path: string[]) => {
      const fullName = this.getPropertyFullName(path)?.toLowerCase();
      return !query || (fullName && fullName.includes(query));
    });
  }

  getPropertyFullName(path: string[]) {
    return this.propertyStore.getFullNameFromPath(path);
  }

  isPropertyPathFiltered(path: string[]) {
    return this.filterStore.filterPaths.some(
      (filterPath: string[]) =>
        filterPath.length === path.length &&
        filterPath.every((segment, i) => segment === path[i]),
    );
  }

  togglePropertyPathFiltering(path: string[]) {
    this.filterStore.togglePropertyPathFiltering(path);
  }
}
</script>
