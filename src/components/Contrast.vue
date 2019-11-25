<template>
  <svg></svg>
</template>

<script lang="ts">
import { Vue, Component, Prop, Emit } from "vue-property-decorator";

@Component
export default class Contrast extends Vue {
  @Prop()
  readonly dim!: IDimen;
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
