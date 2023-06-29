import { debounce } from "lodash-es";

/**
 * Debounce decorator for a function
 * @param debounceArgs The arguments given to the original "debounce" after the function (wait and DebounceSettings)
 */
export function Debounce(...debounceArgs: any[]) {
  return function decorator(_target: any, _name: any, descriptor: any) {
    const original = descriptor.value;
    const debounced = debounce(original, ...debounceArgs);
    descriptor.value = debounced;
    return descriptor;
  };
}
