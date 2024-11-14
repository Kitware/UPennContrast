<template>
  <v-dialog v-model="showDialog" width="50%">
    <v-card>
      <v-card-title> Color selected annotations </v-card-title>
      <v-card-text>
        <v-checkbox
          v-model="localUseColorFromLayer"
          label="Use color from layer"
        />
        <color-picker-menu
          v-if="!localUseColorFromLayer"
          v-model="localCustomColor"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="warning" @click="showDialog = false"> Cancel </v-btn>
        <v-btn color="primary" @click="submit"> Apply color </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";
import ColorPickerMenu from "@/components/ColorPickerMenu.vue";

@Component({
  components: { ColorPickerMenu },
})
export default class ColorSelectionDialog extends Vue {
  @Prop({ type: Boolean, required: true })
  show!: boolean;

  localUseColorFromLayer: boolean = true;
  localCustomColor: string = "#FFFFFF";

  get showDialog() {
    return this.show;
  }

  set showDialog(value: boolean) {
    this.$emit("update:show", value);
  }

  submit() {
    this.$emit("submit", {
      useColorFromLayer: this.localUseColorFromLayer,
      color: this.localCustomColor,
    });
    this.localUseColorFromLayer = true;
    this.localCustomColor = "#FFFFFF";
    this.showDialog = false;
  }
}
</script>
