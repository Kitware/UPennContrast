<template>
  <router-view></router-view>
</template>
<script lang="ts">
import { Vue, Component, Inject, Prop } from "vue-property-decorator";
import store from "@/store";
import { Route, RawLocation } from "vue-router";

@Component
export default class Viewer extends Vue {
  readonly store = store;

  @Prop({
    required: true
  })
  readonly id!: string;

  beforeRouteEnter(
    to: Route,
    _from: Route,
    next: (to?: RawLocation | false | ((vm: Vue) => any) | void) => any
  ) {
    if (to.params.id && store.selectedItemId !== to.params.id) {
      store.setSelectedItem(to.params.id).then(() => next());
    }
  }
  // when route changes and this component is already rendered,
  // the logic will be slightly different.
  beforeRouteUpdate(
    to: Route,
    _from: Route,
    next: (to?: RawLocation | false | ((vm: Vue) => any) | void) => any
  ) {
    if (to.params.id && store.selectedItemId !== to.params.id) {
      store.setSelectedItem(to.params.id).then(() => next());
    }
  }

  beforeRouteLeave(
    to: Route,
    _from: Route,
    next: (to?: RawLocation | false | ((vm: Vue) => any) | void) => any
  ) {
    if (!to.params.id) {
      store.setSelectedItem(null).then(() => next());
    }
  }
}
</script>
