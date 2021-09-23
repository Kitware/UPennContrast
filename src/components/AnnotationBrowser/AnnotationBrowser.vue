<template>
  <v-container>
    <v-row>
      <property-list></property-list>
    </v-row>
    <v-row><annotation-toggles /></v-row>
    <v-row><annotation-filters /></v-row>
    <v-row><annotation-list @clickedTag="clickedTag"></annotation-list> </v-row>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import AnnotationToggles from "@/components/AnnotationBrowser/AnnotationToggles.vue";
import AnnotationFilters from "@/components/AnnotationBrowser/AnnotationFilters.vue";
import AnnotationList from "@/components/AnnotationBrowser/AnnotationList.vue";
import PropertyList from "@/components/AnnotationBrowser/AnnotationProperties/PropertyList.vue";
import filterStore from "@/store/filters";

@Component({
  components: {
    AnnotationToggles,
    AnnotationFilters,
    AnnotationList,
    PropertyList
  }
})
export default class AnnotationBrowser extends Vue {
  readonly filterStore = filterStore;
  clickedTag(tag: string) {
    this.filterStore.addTagToTagFilter(tag);
  }
}
</script>
