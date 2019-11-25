<template>
  <div>{{ name }}</div>
</template>
<script lang="ts">
import { Vue, Component, Inject, Prop } from "vue-property-decorator";
import store from "@/store";

@Component
export default class DatasetInfo extends Vue {
  readonly store = store;

  get name() {
    return store.dataset ? store.dataset.name : "";
  }
}
</script>
