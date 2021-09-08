<template>
  <v-card>
    <v-card-title>
      <v-subheader>Filters</v-subheader>
    </v-card-title>
    <v-card-text>
      <v-container>
        <v-row>
          <v-col>
            <v-combobox
              :value="mergedTags"
              @input="addedTags"
              :items="tagList"
              :search-input.sync="tagSearchInput"
              @change="changed"
              label="Assign Tags"
              multiple
              hide-selected
              small-chips
              dense
            >
              <template v-slot:selection="{ attrs, index, item }">
                <v-chip
                  :key="index"
                  class="pa-2"
                  v-bind="attrs"
                  close
                  small
                  @click:close="removeTag(item)"
                >
                  {{ item }}
                </v-chip>
              </template>
            </v-combobox>
          </v-col>
          <v-spacer> </v-spacer>
          <v-col>
            <v-checkbox
              label="Exclusive"
              v-model="exclusive"
              @click="changed"
            ></v-checkbox>
          </v-col>
        </v-row>
      </v-container>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch, VModel } from "vue-property-decorator";
import store from "@/store";
import { IToolConfiguration, IAnnotation } from "@/store/model";

@Component({
  components: {}
})
export default class AnnotationFilter extends Vue {
  readonly store = store;

  get tagList(): string[] {
    return this.store.tools
      .filter(
        (tool: IToolConfiguration) =>
          (tool.type === "create" || tool.type === "snap") &&
          tool.values.annotation
      )
      .map((tool: IToolConfiguration) => tool.values.annotation.tags)
      .flat();
  }

  @Prop()
  readonly additionalTags!: string[];

  tagSearchInput: string = "";
  tags: string[] = [];
  get mergedTags(): string[] {
    return [...this.tags, ...this.additionalTags].filter(
      (tag, index, array) => array.indexOf(tag) === index
    );
  }

  exclusive: boolean = false;

  changed() {
    const filters = [];
    if (this.mergedTags && this.mergedTags.length) {
      const includes = (tag: string) => this.mergedTags.includes(tag);
      if (this.exclusive) {
        filters.push(
          (annotation: IAnnotation) =>
            !!annotation.tags &&
            annotation.tags.length > 0 &&
            annotation.tags.every(includes)
        );
      }
      filters.push(
        (annotation: IAnnotation) =>
          !!annotation.tags &&
          annotation.tags.length > 0 &&
          this.mergedTags.every((tag: string) => annotation.tags.includes(tag))
      );
    }
    this.filters = filters;
  }
  @VModel() filters!: { (annotation: IAnnotation): boolean }[];

  addedTags(tags: string[]) {
    this.tags = tags.filter(
      (tag: string) => !this.additionalTags.includes(tag)
    );
  }

  removeTag(tag: string) {
    if (this.tags.includes(tag)) {
      this.tags = this.tags.filter(
        (tagToFilter: string) => tagToFilter !== tag
      );
    } else {
      this.$emit("removedTag", tag);
    }
  }

  @Watch("mergedTags") update() {
    this.changed();
  }
}
</script>
