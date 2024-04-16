import { Vue } from "vue-property-decorator";
import VueRouter, { RawLocation, Route } from "vue-router";
import { logError } from "./log";
import { awaitPreviousCallsDecorator } from "./lock";

export interface IMapper<T> {
  parse(value: string): T;
  get(): T | null;
  set(value: T | null): Promise<any>;
}

// Must be unique
// Avoid "navigation cancelled" errors by doing calls to router.replace() one at a time
const setUrlParamsOrQuery = awaitPreviousCallsDecorator(
  async (
    type: "query" | "params",
    key: string,
    value: string,
    router: VueRouter,
    route: Route,
  ) => {
    const stringifiedValue = String(value);
    if (stringifiedValue === route[type][key]) {
      return;
    }
    await router.replace({
      [type]: {
        ...route[type],
        [key]: stringifiedValue,
      },
    });
  },
);

// This counter is used to avoid loops of changes to the URL and changes to the mapper values
// It counts how many instances of onRouteChange are being called
let currentRouteChanges = 0;

// Call the setter for this mapper if needed, using the value from the URL
const setMapperValueFromUrl = (
  obj: IMapper<any>,
  urlValue: string | undefined,
) => {
  if (urlValue === undefined) {
    return;
  }
  const parsedUrlValue = obj.parse(urlValue);
  const currentValue = obj.get();
  if (parsedUrlValue == currentValue) {
    return;
  }
  return obj.set(parsedUrlValue);
};

// When the params/query in the URL change, call the setters accordingly
const createRouteChangeCallback =
  (
    paramsMapper: { [key: string]: IMapper<any> },
    queryMapper: { [key: string]: IMapper<any> },
  ) =>
  async (
    to: Route,
    _from: Route,
    next: (to?: RawLocation | false | ((vm: Vue) => any) | void) => any,
  ) => {
    // Avoid changes made to the store to trigger changes in the URL
    currentRouteChanges++;

    // Call setters for params and query
    const paramsSetPromises = Object.entries(paramsMapper).map(
      ([key, mapper]) => {
        return setMapperValueFromUrl(mapper, to.params[key]);
      },
    );
    const querySetPromises = Object.entries(queryMapper).map(
      ([key, mapper]) => {
        // We don't handle lists in query yet
        return setMapperValueFromUrl(
          mapper,
          to.query[key] as string | undefined,
        );
      },
    );

    // Wait for all params/query to be set before continuing
    try {
      await Promise.all([...paramsSetPromises, ...querySetPromises]);
      next();
    } catch (e) {
      logError(e);
    } finally {
      currentRouteChanges--;
    }
  };

// Create a computed property per mapper, so that it can be watched
// Only create the getter of the mapper, don't create the setter
const createGetters = (mappersObject: { [key: string]: IMapper<any> }) =>
  Object.fromEntries(
    Object.entries(mappersObject).map(([key, { get }]) => [key, { get }]),
  );

// When the computed property changes (usually in the store), change the params/query in the URL accordingly
// The keys should be computed properties
const createWatchers = (type: "query" | "params", keys: string[]) => {
  return Object.fromEntries(
    keys.map((key) => [
      key,
      async function (this: Vue, value: any) {
        if (currentRouteChanges > 0) {
          return;
        }
        await setUrlParamsOrQuery(type, key, value, this.$router, this.$route);
      },
    ]),
  );
};

/**
 * component generator that will handle route params query params by syncing them with the given mapper information
 * @param paramsMapper
 * @param queryMapper
 */
export default function routeMapper(
  paramsMapper: { [key: string]: IMapper<any> },
  queryMapper: { [key: string]: IMapper<any> } = {},
) {
  const onRouteChange = createRouteChangeCallback(paramsMapper, queryMapper);
  return Vue.extend({
    computed: {
      ...createGetters(paramsMapper),
      ...createGetters(queryMapper),
    },
    watch: {
      ...createWatchers("params", Object.keys(paramsMapper)),
      ...createWatchers("query", Object.keys(queryMapper)),
    },
    beforeRouteEnter: onRouteChange,
    beforeRouteUpdate: onRouteChange,
  });
}
