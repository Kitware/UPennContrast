<template>
  <v-slider v-model="slider" :max="max" :min="min" hide-details :label="label">
    <template #append>
      <v-text-field
        v-model="slider"
        class="mt-0 pt-0"
        hide-details
        single-line
        type="number"
        :min="min"
        :max="max"
        style="width: 60px"
      ></v-text-field>
    </template>
  </v-slider>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";

@Component
export default class ValueSlider extends Vue {
  @Prop()
  readonly value!: number;
  @Prop()
  readonly min!: number;
  @Prop()
  readonly max!: number;
  @Prop()
  readonly label!: string;

  private internalValue = this.value;

  get slider() {
    return this.internalValue;
  }

  set slider(value: number) {
    this.internalValue = value;
    this.$emit("input", value);
  }

  @Watch("value")
  watchValue(value: number) {
    this.internalValue = value;
  }
}
</script>
