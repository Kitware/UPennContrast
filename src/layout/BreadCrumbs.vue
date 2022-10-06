<template>
  <v-breadcrumbs :items="items" divider="">
    <template v-slot:item="{ item }">
      <span class="mx-0 px-1">
        <v-breadcrumbs-item class="ma-0 pa-0">
          {{ item.title }}
        </v-breadcrumbs-item>
        <v-breadcrumbs-item v-bind="item" class="px-2">
          {{ item.text }}
        </v-breadcrumbs-item>
      </span>
    </template>
  </v-breadcrumbs>
</template>

<script lang="ts">
import { Vue, Component } from "vue-property-decorator";
import store from "@/store";

@Component
export default class BreadCrumbs extends Vue {
  readonly store = store;

  get items() {
    const titles = ["Dataset:", "Configuration:"];
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
          },
          title: ""
        };
      })
      .slice(-2)
      .map((item, i) => Object.assign(item, { title: titles[i] }));
  }
}
</script>
