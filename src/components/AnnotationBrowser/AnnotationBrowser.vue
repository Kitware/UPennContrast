<template>
  <v-container>
    <v-row
      ><v-col class="py-1"><annotation-toggles /></v-col
    ></v-row>

    <v-row
      ><v-col class="py-1"><annotation-filters /></v-col
    ></v-row>
    <v-row
      ><v-col class="py-1"> <property-list></property-list> </v-col
    ></v-row>
    <v-row
      ><v-col class="py-1"
        ><annotation-list @clickedTag="clickedTag"></annotation-list> </v-col
    ></v-row>
    <v-row
      ><v-col class="py-1"> <annotation-actions></annotation-actions> </v-col
    ></v-row>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import AnnotationToggles from "@/components/AnnotationBrowser/AnnotationToggles.vue";
import AnnotationFilters from "@/components/AnnotationBrowser/AnnotationFilters.vue";
import AnnotationList from "@/components/AnnotationBrowser/AnnotationList.vue";
import AnnotationActions from "@/components/AnnotationBrowser/AnnotationActions.vue";
import PropertyList from "@/components/AnnotationBrowser/AnnotationProperties/PropertyList.vue";
import filterStore from "@/store/filters";

@Component({
  components: {
    AnnotationActions,
    AnnotationList,
    AnnotationFilters,
    AnnotationToggles,
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
