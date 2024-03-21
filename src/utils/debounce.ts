import { debounce } from "lodash";

type ParametersExceptFirst<F> = F extends (arg0: any, ...rest: infer R) => any
  ? R
  : never;

/**
 * Debounce decorator for a function
 * @param debounceArgs The arguments given to the original "debounce" after the function (wait and DebounceSettings)
 */
export function Debounce(
  ...debounceArgs: ParametersExceptFirst<typeof debounce>
) {
  return function decorator(_target: any, _name: any, descriptor: any) {
    const original = descriptor.value;
    const debounced = debounce(original, ...debounceArgs);
    descriptor.value = debounced;
    return descriptor;
  };
}
