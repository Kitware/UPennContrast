<template>
  <v-breadcrumbs :items="items" />
</template>

<style>
.v-breadcrumbs .v-breadcrumbs__divider {
  display: none;
}
.v-breadcrumbs li:first-child:before {
  content: "Dataset:";
  padding-right: 5px;
}
.v-breadcrumbs li:last-child:before {
  content: "Configuration:";
  padding-left: 15px;
  padding-right: 5px;
}
</style>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";

@Component
export default class BreadCrumbs extends Vue {
  readonly store = store;

  get items() {
    return this.$route.matched
      .filter(m => !m.meta.hidden)
      .filter(m => m.name !== "view")
      .map(record => {
        const customText = record.meta.text;
        let text = customText
          ? typeof customText === "function"
            ? customText(this.store)
            : customText
          : record.name;
        return {
          exact: true,
          text,
          to: {
            name: record.name || record.meta.name,
            params: this.$route.params
          }
        };
      });
  }
}
</script>
