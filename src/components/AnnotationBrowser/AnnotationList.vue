<template>
  <div>
    <v-subheader>Annotation List</v-subheader>
    <v-data-table :items="filteredAnnotations" :headers="headers">
      <!-- Tags -->
      <template v-slot:item.tags="{ item }">
        <v-chip
          v-for="tag in item.tags"
          :key="tag"
          x-small
          @click="clickedTag(tag)"
          >{{ tag }}</v-chip
        >
      </template>
    </v-data-table>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, Emit } from "vue-property-decorator";
import store from "@/store";
import { IAnnotation } from "@/store/model";

@Component({
  components: {}
})
export default class AnnotationList extends Vue {
  readonly store = store;
  log(item: any) {
    console.log(item);
  }
  // TODO: fetch for other configurations ?
  get annotations(): IAnnotation[] {
    return this.store.annotations;
  }

  get filteredAnnotations(): IAnnotation[] {
    return this.filters.reduce(
      (annotations, filter) => annotations.filter(filter),
      this.annotations
    );
  }

  headers = [
    {
      text: "Annotation ID",
      value: "id"
    },
    {
      text: "Shape",
      value: "shape"
    },
    {
      text: "Tags",
      value: "tags"
    }
  ];

  @Prop()
  readonly filters!: { (annotation: IAnnotation): boolean }[];

  @Emit("clickedTag")
  clickedTag(tag: string) {
    return tag;
  }
}
</script>
