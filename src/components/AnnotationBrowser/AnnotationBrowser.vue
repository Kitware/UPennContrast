<template>
  <v-card class="ma-1">
    <v-card-title>
      Annotation Browser
    </v-card-title>
    <v-card-text class="pa-1">
      <v-expansion-panels hover multiple v-model="expanded">
        <annotation-filters></annotation-filters>
        <annotation-actions></annotation-actions>
        <annotation-list @clickedTag="clickedTag"></annotation-list>
      </v-expansion-panels>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import AnnotationFilters from "@/components/AnnotationBrowser/AnnotationFilters.vue";
import AnnotationList from "@/components/AnnotationBrowser/AnnotationList.vue";
import AnnotationActions from "@/components/AnnotationBrowser/AnnotationActions.vue";
import filterStore from "@/store/filters";

@Component({
  components: {
    AnnotationActions,
    AnnotationList,
    AnnotationFilters
  }
})
export default class AnnotationBrowser extends Vue {
  readonly filterStore = filterStore;

  expanded: number[] = [2];

  clickedTag(tag: string) {
    this.filterStore.addTagToTagFilter(tag);
  }
}
</script>
