<template>
  <div v-if="filter">
    <v-container>
      <v-row>
        <v-col class="pa-1" v-if="!property">
          <v-checkbox
            dense
            hide-details
            label="Enable Tag Filter"
            v-model="enabled"
          ></v-checkbox>
        </v-col>
        <v-divider></v-divider>
        <v-col class="pa-1">
          <v-checkbox
            dense
            hide-details
            label="Exclusive"
            v-model="exclusive"
          ></v-checkbox>
        </v-col>
        <v-col class="pa-1">
          <tag-picker v-model="tags"> </tag-picker>
        </v-col>
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

  @Prop()
  readonly property!: boolean;

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
