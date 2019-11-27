import { Vue } from "vue-property-decorator";
import { RawLocation, Route } from "vue-router";

export interface IMapper<T> {
  parse(value: string): T;
  get(): T | null;
  set(value: T | null): Promise<any>;
}

export default function routeMapper(
  params: { [key: string]: IMapper<any> },
  query: { [key: string]: IMapper<any> } = {}
) {
  const handle = (params: any, key: string, obj: IMapper<any>) => {
    if (params[key] && obj.get() !== obj.parse(params[key])) {
      return obj.set(obj.parse(params[key]));
    } else {
      return Promise.resolve(null);
    }
  };
  const handleReset = (params: any, key: string, obj: IMapper<any>) => {
    if (!params[key]) {
      return obj.set(null);
    } else {
      return Promise.resolve(null);
    }
  };

  return Vue.extend({
    beforeRouteEnter(
      to: Route,
      _from: Route,
      next: (to?: RawLocation | false | ((vm: Vue) => any) | void) => any
    ) {
      const ps = Object.keys(params).map(key =>
        handle(to.params, key, params[key])
      );
      const qs = Object.keys(query).map(key =>
        handle(to.query, key, query[key])
      );
      Promise.all([...ps, ...qs]).then(() => next());
    },
    // when route changes and this component is already rendered,
    // the logic will be slightly different.
    beforeRouteUpdate(
      to: Route,
      _from: Route,
      next: (to?: RawLocation | false | ((vm: Vue) => any) | void) => any
    ) {
      const ps = Object.keys(params).map(key =>
        handle(to.params, key, params[key])
      );
      const qs = Object.keys(query).map(key =>
        handle(to.query, key, query[key])
      );
      Promise.all([...ps, ...qs]).then(() => next());
    },

    beforeRouteLeave(
      to: Route,
      _from: Route,
      next: (to?: RawLocation | false | ((vm: Vue) => any) | void) => any
    ) {
      const ps = Object.keys(params).map(key =>
        handleReset(to.params, key, params[key])
      );
      const qs = Object.keys(query).map(key =>
        handleReset(to.query, key, query[key])
      );
      Promise.all([...ps, ...qs]).then(() => next());
    }
  });
}
