<template>
  <v-menu v-model="showMenu" :position-x="x" :position-y="y" absolute offset-y>
    <v-card min-width="200">
      <v-card-title class="text-subtitle-1">Edit Annotation</v-card-title>
      <v-card-text>
        <color-picker-menu v-model="selectedColor" />
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text @click="cancel">Cancel</v-btn>
        <v-btn color="primary" @click="save">OK</v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import ColorPickerMenu from "@/components/ColorPickerMenu.vue";
import { IAnnotation } from "@/store/model";

@Component({
  components: { ColorPickerMenu },
})
export default class AnnotationContextMenu extends Vue {
  @Prop({ required: true })
  readonly show!: boolean;

  @Prop({ required: true })
  readonly x!: number;

  @Prop({ required: true })
  readonly y!: number;

  @Prop({ required: true })
  readonly annotation!: IAnnotation | null;

  selectedColor = "#FFFFFF";

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
      this.selectedColor = this.annotation.color || "#FFFFFF";
    }
  }

  cancel() {
    this.$emit("cancel");
  }

  save() {
    this.$emit("save", {
      annotationId: this.annotation?.id,
      color: this.selectedColor,
    });
  }
}
</script>
