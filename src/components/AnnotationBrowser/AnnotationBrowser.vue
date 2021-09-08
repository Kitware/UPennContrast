<template>
  <v-container>
    <v-row><annotation-toggles /></v-row>
    <v-row
      ><annotation-filters
        v-model="filters"
        :additionalTags="additionalTags"
        @removedTag="removedTag"
    /></v-row>
    <v-row
      ><annotation-list :filters="filters" @clickedTag="clickedTag"
    /></v-row>
  </v-container>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import AnnotationToggles from "@/components/AnnotationBrowser/AnnotationToggles.vue";
import AnnotationFilters from "@/components/AnnotationBrowser/AnnotationFilters.vue";
import AnnotationList from "@/components/AnnotationBrowser/AnnotationList.vue";
import store from "@/store";
import { IAnnotation } from "@/store/model";

@Component({
  components: {
    AnnotationToggles,
    AnnotationFilters,
    AnnotationList
  }
})
export default class AnnotationBrowser extends Vue {
  readonly store = store;

  filters: { (annotation: IAnnotation): boolean }[] = [];

  additionalTags: string[] = [];
  clickedTag(tag: string) {
    if (!this.additionalTags.includes(tag)) {
      this.additionalTags = [...this.additionalTags, tag];
    }
  }

  removedTag(tag: string) {
    this.additionalTags = this.additionalTags.filter(
      tagToFilter => tagToFilter !== tag
    );
  }
}
</script>
