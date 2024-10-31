<template>
  <v-menu v-model="showMenu" :position-x="x" :position-y="y" absolute offset-y>
    <v-card min-width="300" @click.stop>
      <v-card-title class="text-subtitle-1">Edit Annotation</v-card-title>
      <v-card-text>
        <v-checkbox
          v-model="useLayerColor"
          label="Default to color of layer"
          class="mb-2"
        />
        <color-picker-menu v-model="selectedColor" :disabled="useLayerColor" />
        <v-divider class="my-3"></v-divider>
        <tag-picker v-model="selectedTags" />
        <v-checkbox
          v-model="applyToSameTags"
          label="Apply to all annotations with same tags"
          class="mb-2"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text @click="cancel">Cancel</v-btn>
        <v-btn color="primary" @click="save">Apply</v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import ColorPickerMenu from "@/components/ColorPickerMenu.vue";
import TagPicker from "@/components/TagPicker.vue";
import { IAnnotation } from "@/store/model";
import store from "@/store";
import annotationStore from "@/store/annotation";
import { tagFilterFunction } from "@/utils/annotation";

@Component({
  components: { ColorPickerMenu, TagPicker },
})
export default class AnnotationContextMenu extends Vue {
  readonly store = store;
  readonly annotationStore = annotationStore;

  @Prop({ required: true })
  readonly show!: boolean;

  @Prop({ required: true })
  readonly x!: number;

  @Prop({ required: true })
  readonly y!: number;

  @Prop({ required: true })
  readonly annotation!: IAnnotation | null;

  selectedColor = "#FFFFFF";
  selectedTags: string[] = [];
  useLayerColor = false;
  applyToSameTags = false;

  get showMenu() {
    return this.show;
  }

  set showMenu(value: boolean) {
    if (!value) {
      this.$emit("cancel");
    }
  }

  @Watch("annotation", { immediate: true })
  onAnnotationChange() {
    if (this.annotation) {
      this.useLayerColor = this.annotation.color === null;
      this.selectedColor = this.annotation.color || "#FFFFFF";
      this.selectedTags = [...this.annotation.tags];
    }
  }

  cancel() {
    this.$emit("cancel");
  }

  save() {
    if (!this.annotation) {
      return;
    }

    const newColor = this.useLayerColor ? null : this.selectedColor;
    const tagsChanged = !this.areTagsEqual(
      this.annotation.tags,
      this.selectedTags,
    );

    if (this.applyToSameTags) {
      // Get all annotations with the same original tags
      const annotationsWithSameTags = this.annotationStore.annotations.filter(
        (annotation: IAnnotation) =>
          this.annotation &&
          annotation.tags.length === this.annotation.tags.length &&
          annotation.tags.every((tag) => this.annotation!.tags.includes(tag)),
      );
      const annotationIds = annotationsWithSameTags.map(
        (a: IAnnotation) => a.id,
      );

      // Update colors if changed
      if (this.annotation.color !== newColor) {
        this.annotationStore.colorAnnotationIds({
          annotationIds,
          color: newColor,
        });
      }

      // Update tags if changed
      if (tagsChanged) {
        this.annotationStore.replaceTagsByAnnotationIds({
          annotationIds,
          tags: this.selectedTags,
        });
      }
    } else {
      // Single annotation updates
      if (this.annotation.color !== newColor) {
        this.$emit("save", {
          annotationId: this.annotation.id,
          color: newColor,
        });
      }

      if (tagsChanged) {
        this.annotationStore.replaceTagsByAnnotationIds({
          annotationIds: [this.annotation.id],
          tags: this.selectedTags,
        });
      }
    }

    this.$emit("cancel"); // Close the menu
  }

  private areTagsEqual(tags1: string[], tags2: string[]): boolean {
    return tagFilterFunction(tags1, tags2, true);
  }
}
</script>
