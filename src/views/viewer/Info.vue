<template>
  <div>{{ name }}</div>
</template>
<script lang="ts">
import { Vue, Component, Inject, Prop } from "vue-property-decorator";
import store from "@/store";
import { Route, RawLocation } from "vue-router";

@Component
export default class Info extends Vue {
  readonly store = store;

  get name() {
    return this.store.selectedItem ? this.store.selectedItem.name : null;
  }
}
</script>
