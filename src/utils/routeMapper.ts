import { Vue } from "vue-property-decorator";
import { RawLocation, Route } from "vue-router";

export default function routeMapper(
  paramKey: string,
  get: () => string | null,
  set: (value: string | null) => Promise<any>
) {
  return Vue.extend({
    beforeRouteEnter(
      to: Route,
      _from: Route,
      next: (to?: RawLocation | false | ((vm: Vue) => any) | void) => any
    ) {
      if (to.params[paramKey] && get() !== to.params[paramKey]) {
        set(to.params[paramKey]).then(() => next());
      } else {
        next();
      }
    },
    // when route changes and this component is already rendered,
    // the logic will be slightly different.
    beforeRouteUpdate(
      to: Route,
      _from: Route,
      next: (to?: RawLocation | false | ((vm: Vue) => any) | void) => any
    ) {
      if (to.params[paramKey] && get() !== to.params[paramKey]) {
        set(to.params[paramKey]).then(() => next());
      } else {
        next();
      }
    },

    beforeRouteLeave(
      to: Route,
      _from: Route,
      next: (to?: RawLocation | false | ((vm: Vue) => any) | void) => any
    ) {
      if (!to.params[paramKey]) {
        set(null).then(() => next());
      } else {
        next();
      }
    }
  });
}
