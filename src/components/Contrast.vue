<template>
  <svg></svg>
</template>

<script lang="ts">
import { Vue, Component, Prop, Emit } from "vue-property-decorator";
import { IDimension } from "../store/model";

@Component
export default class Contrast extends Vue {
  @Prop()
  readonly dim!: IDimension;
  @Prop()
  readonly min!: number;
  @Prop()
  readonly max!: number;
}
</script>
