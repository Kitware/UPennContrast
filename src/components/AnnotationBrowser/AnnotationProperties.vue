<template>
  <v-expansion-panel>
    <v-expansion-panel-header>
      Properties
    </v-expansion-panel-header>
    <v-expansion-panel-content>
      <v-container>
        <v-row class="caption text-center text--secondary font-weight-bold">
          <v-col class="px-1">
            Name
            <v-chip small class="mx-1">tags</v-chip>
          </v-col>
          <v-col cols="2" class="px-1">
            List property value
          </v-col>
          <v-col cols="2" class="px-1">
            Use property value as filter
          </v-col>
        </v-row>
        <v-divider class="my-2" />
        <div v-for="property of properties" :key="property.id">
          <v-row>
            <v-col>
              {{ property.name }}
              <v-chip
                v-for="(tag, idx) in property.tags.tags"
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
                  :value="propertyIdsInAnnotationList.includes(property.id)"
                  @click.stop="() => toggleList(property.id)"
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
                  :value="propertyIdsInFilter.includes(property.id)"
                  @click.stop="() => toggleFilter(property.id)"
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

@Component
export default class AnnotationProperties extends Vue {
  readonly propertyStore = propertyStore;
  readonly filterStore = filterStore;

  get properties() {
    return this.propertyStore.properties;
  }

  get propertyIdsInAnnotationList() {
    return this.propertyStore.annotationListIds;
  }

  get propertyIdsInFilter() {
    return this.filterStore.filterIds;
  }

  toggleList(propertyId: string) {
    if (this.propertyIdsInAnnotationList.includes(propertyId)) {
      this.propertyStore.removeAnnotationListId(propertyId);
    } else {
      this.propertyStore.addAnnotationListId(propertyId);
    }
  }

  toggleFilter(propertyId: string) {
    if (this.propertyIdsInFilter.includes(propertyId)) {
      this.filterStore.removeFilterId(propertyId);
    } else {
      this.filterStore.addFilterId(propertyId);
    }
  }
}
</script>
