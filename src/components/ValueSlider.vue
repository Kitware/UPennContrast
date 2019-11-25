<template>
  <v-slider v-model="slider" :max="max" :min="min" hide-details>
    <template v-slot:append>
      <v-text-field
        v-model="slider"
        class="mt-0 pt-0"
        hide-details
        single-line
        type="number"
        style="width: 60px"
      ></v-text-field>
    </template>
  </v-slider>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";

@Component
export default class ValueSlider extends Vue {
  @Prop()
  readonly value!: number;
  @Prop()
  readonly min!: number;
  @Prop()
  readonly max!: number;

  get slider() {
    return this.value;
  }

  set slider(value: number) {
    this.$emit("change", value);
  }
}
</script>
