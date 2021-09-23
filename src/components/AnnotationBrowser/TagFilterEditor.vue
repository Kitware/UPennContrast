<template>
  <div v-if="filter">
    <v-container>
      <v-row>
        <v-col class="pa-1" cols="3" v-if="!property">
          <v-checkbox
            dense
            hide-details
            label="Enable"
            v-model="enabled"
          ></v-checkbox>
        </v-col>
        <v-col class="pa-1">
          <tag-picker v-model="tags"> </tag-picker>
        </v-col>
        <v-col class="pa-1" cols="5">
          <v-checkbox
            dense
            hide-details
            label="Exclusive"
            v-model="exclusive"
          ></v-checkbox>
        </v-col>
      </v-row>
      <v-row v-if="!property">
        <v-select dense hide-details v-model="shape" :items="shapes"></v-select>
      </v-row>
    </v-container>
  </div>
</template>
<script lang="ts">
import { Vue, Component, Watch, Prop, VModel } from "vue-property-decorator";
import { ITagAnnotationFilter } from "@/store/model";
import TagPicker from "@/components/TagPicker.vue";

@Component({
  components: {
    TagPicker
  }
})
export default class TagFilterEditor extends Vue {
  @VModel({ type: Object }) filter!: ITagAnnotationFilter;

  shapes: string[] = ["point", "polygon", "line"];

  @Prop()
  readonly property!: boolean;

  get shape() {
    return this.filter.shape;
  }

  set shape(shape: string) {
    this.filter = { ...this.filter, shape };
  }
  get tags() {
    return this.filter.tags;
  }

  set tags(tags: string[]) {
    this.filter = { ...this.filter, tags };
  }

  get enabled() {
    return this.filter.enabled;
  }

  set enabled(enabled: boolean) {
    this.filter = { ...this.filter, enabled };
  }

  get exclusive() {
    return this.filter.exclusive;
  }

  set exclusive(exclusive: boolean) {
    this.filter = { ...this.filter, exclusive };
  }
}
</script>
