<template>
  <v-breadcrumbs :items="items" />
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";

@Component
export default class BreadCrumbs extends Vue {
  readonly store = store;

  get items() {
    if (this.store.selectedItem) {
      return [
        {
          text: this.store.selectedItem.name,
          to: { name: "view", params: { id: this.store.selectedItem._id } }
        }
      ];
    }
    return [];
  }
}
</script>
