<template>
  <v-expansion-panel>
    <v-expansion-panel-header> Properties </v-expansion-panel-header>
    <v-expansion-panel-content>
      <v-container>
        <v-row class="mb-2">
          <v-col>
            <v-text-field
              v-model="propFilter"
              label="Filter properties"
              single-line
              clearable
              dense
              @click:clear="clearFilter"
            ></v-text-field>
          </v-col>
        </v-row>
        <v-row class="caption text-center text--secondary font-weight-bold">
          <v-col class="px-1">
            Name
            <v-chip small class="mx-1">tags</v-chip>
          </v-col>
          <v-col cols="2" class="px-1"> List property value </v-col>
          <v-col cols="2" class="px-1"> Use property value as filter </v-col>
        </v-row>
        <v-divider class="my-2" />
        <div
          v-for="(propertyPath, idx) of filteredPropertyPaths"
          :key="'property ' + idx"
        >
          <v-row>
            <v-col>
              {{ propertyStore.getFullNameFromPath(propertyPath) }}
              <v-chip
                v-for="(tag, idx) in getTagsForPath(propertyPath)"
                :key="idx"
                small
                class="mx-1"
              >
                {{ tag }}
              </v-chip>
            </v-col>
            <!-- In list checkbox -->
            <v-col cols="2">
              <div>
                <v-checkbox
                  dense
                  hide-details
                  :value="
                    findIndexOfPath(
                      propertyPath,
                      propertyStore.displayedPropertyPaths,
                    ) >= 0
                  "
                  @click.stop="() => toggleList(propertyPath)"
                  class="ma-0"
                />
              </div>
            </v-col>
            <!-- As filter checkbox -->
            <v-col cols="2">
              <div>
                <v-checkbox
                  dense
                  hide-details
                  :value="
                    findIndexOfPath(propertyPath, filterStore.filterPaths) >= 0
                  "
                  @click.stop="() => toggleFilter(propertyPath)"
                  class="ma-0"
                />
              </div>
            </v-col>
          </v-row>
          <v-divider class="my-2" />
        </div>
      </v-container>
    </v-expansion-panel-content>
  </v-expansion-panel>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import propertyStore from "@/store/properties";
import filterStore from "@/store/filters";
import { findIndexOfPath } from "@/utils/paths";

@Component
export default class AnnotationProperties extends Vue {
  readonly propertyStore = propertyStore;
  readonly filterStore = filterStore;
  readonly findIndexOfPath = findIndexOfPath;

  propFilter: string = "";

  get computedPropertyPaths() {
    return this.propertyStore.computedPropertyPaths;
  }

  get filteredPropertyPaths() {
    const filter = this.propFilter.toLowerCase().trim();
    if (!filter) {
      return this.computedPropertyPaths;
    }
    return this.computedPropertyPaths.filter(path => {
      const fullName = this.propertyStore.getFullNameFromPath(path);
      return fullName !== null && fullName.toLowerCase().includes(filter);
    });
  }

  getTagsForPath(path: string[]) {
    const property = this.propertyStore.getPropertyById(path[0]);
    return property?.tags.tags || [];
  }

  toggleList(propertyPath: string[]) {
    this.propertyStore.togglePropertyPathVisibility(propertyPath);
  }

  toggleFilter(propertyPath: string[]) {
    this.filterStore.togglePropertyPathFiltering(propertyPath);
  }

  clearFilter() {
    this.propFilter = "";
  }
}
</script>
