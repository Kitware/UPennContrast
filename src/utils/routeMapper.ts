import { Vue } from "vue-property-decorator";
import { RawLocation, Route } from "vue-router";

export interface IMapper<T> {
  parse(value: string): T;
  get(): T | null;
  set(value: T | null): Promise<any>;
}

/**
 * component generator that will handle route params query params by syncing them with the given mapper information
 * @param params
 * @param query
 */
export default function routeMapper(
  params: { [key: string]: IMapper<any> },
  query: { [key: string]: IMapper<any> } = {}
) {
  const handle = (params: any, key: string, obj: IMapper<any>) => {
    if (params[key] && obj.get() !== obj.parse(params[key])) {
      return obj.set(obj.parse(params[key]));
    } else {
      return Promise.resolve();
    }
  };

  return Vue.extend({
    async beforeRouteEnter(
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
      await Promise.all([...ps, ...qs]);

      next();
    },
    // when route changes and this component is already rendered,
    // the logic will be slightly different.
    async beforeRouteUpdate(
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
      await Promise.all([...ps, ...qs]);
      next();
    }
  });
}
