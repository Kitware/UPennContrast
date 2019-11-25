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
    return this.$route.matched
      .filter(m => !m.meta.hidden)
      .map(record => {
        return {
          text: record.meta.name ? record.meta.name(this.store) : record.name,
          to: { name: record.name, params: this.$route.params }
        };
      });
  }
}
</script>
