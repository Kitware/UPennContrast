<template>
  <div class="d-flex overflow-auto flex-wrap">
    <select-all-none-chips
      @selectAll="selectAll"
      @selectNone="selectNone"
      class="ma-1"
    />
    <v-text-field
      v-model="tagSearchFilter"
      style="max-width: 150px"
      placeholder="Filter tags by..."
      class="ma-1"
    />
    <v-chip-group
      @change="setTagsFromUserInput($event)"
      :value="tags"
      column
      multiple
      active-class="selected-chip"
    >
      <v-chip
        v-for="tag in displayedTags"
        :key="tag"
        :value="tag"
        :class="{
          'selected-chip': tags.includes(tag),
        }"
        outlined
        x-small
        class="d-flex align-center"
      >
        {{ tag }}
        <v-menu offset-y :close-on-content-click="true" bottom>
          <template v-slot:activator="{ on, attrs }">
            <v-icon x-small class="ml-1" v-bind="attrs" v-on="on">
              mdi-chevron-down
            </v-icon>
          </template>
          <v-list dense>
            <v-list-item @click="handleTagAddToAll(tag)">
              <v-list-item-title>Add tag to all annotations</v-list-item-title>
            </v-list-item>
            <v-list-item @click="handleTagRemoveFromAll(tag)">
              <v-list-item-title
                >Remove tag from all annotations</v-list-item-title
              >
            </v-list-item>
          </v-list>
        </v-menu>
      </v-chip>
    </v-chip-group>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Watch, VModel, Prop } from "vue-property-decorator";
import store from "@/store";
import annotationStore from "@/store/annotation";
import SelectAllNoneChips from "./SelectAllNoneChips.vue";

@Component({
  components: {
    SelectAllNoneChips,
  },
})
export default class TagCloudPicker extends Vue {
  @VModel({ type: Array, default: () => [] })
  tags!: string[];

  readonly store = store;
  readonly annotationStore = annotationStore;

  @Prop({ required: true })
  allSelected!: boolean;

  allSelectedInternal = false;
  tagSearchFilter: string = "";

  @Watch("allSelectedInternal")
  emiAllSelected() {
    this.$emit("update:allSelected", this.allSelectedInternal);
  }

  @Watch("allSelected")
  allSelectedPropChanged() {
    this.allSelectedInternal = this.allSelected;
  }

  mounted() {
    this.allSelectedPropChanged();
    this.updateTagsIfAllSelected();
  }

  get availableTags(): string[] {
    return Array.from(
      new Set([...this.annotationStore.annotationTags, ...this.store.toolTags]),
    );
  }

  get displayedTags(): string[] {
    if (!this.tagSearchFilter) {
      return this.availableTags;
    }
    const lowerCaseFilter = this.tagSearchFilter.toLowerCase();
    return this.availableTags.filter((tag) =>
      tag.toLowerCase().includes(lowerCaseFilter),
    );
  }

  @Watch("availableTags")
  @Watch("allSelected")
  updateTagsIfAllSelected() {
    if (this.allSelectedInternal) {
      this.tags = [...this.availableTags];
    }
  }

  setTagsFromUserInput(tags: string[]) {
    this.allSelectedInternal = false;
    this.tags = [...tags];
  }

  selectAll() {
    this.allSelectedInternal = true;
  }

  selectNone() {
    this.setTagsFromUserInput([]);
  }

  async handleTagAddToAll(tag: string) {
    await this.annotationStore.addTagsToAllAnnotations([tag]);
  }

  async handleTagRemoveFromAll(tag: string) {
    await this.annotationStore.removeTagsFromAllAnnotations([tag]);
  }
}
</script>

<style lang="scss" scoped>
.selected-chip {
  border-color: #ffffff !important;
}
</style>
