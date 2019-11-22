<template>
  <div>Viewer</div>
</template>
<script lang="ts">
import { Vue, Component, Inject, Prop } from "vue-property-decorator";
import store from "@/store";

@Component
export default class Viewer extends Vue {
  readonly store = store;

  @Prop({
    required: true
  })
  readonly id!: string;
}
</script>
