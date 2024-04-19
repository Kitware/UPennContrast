/**
 * Wrapper around a promise to get the promise and its resolve function at the same time
 */
export class Lock<T = void> {
  public readonly promise: Promise<T>;
  public readonly resolve: (value: T | PromiseLike<T>) => void;

  constructor() {
    let extractedResolve: typeof this.resolve;
    this.promise = new Promise<T>((resolve) => {
      extractedResolve = resolve;
    });
    this.resolve = extractedResolve!;
  }
}

/**
 * Using this decorator on a function will make the function await for previous calls to the same function
 * This decorator should only be used on asynchronous functions
 * Using it on a synchronous function should work but doesn't make sense
 */
export function awaitPreviousCallsDecorator<F extends (...args: any[]) => any>(
  originalFunction: F,
): (...args: Parameters<F>) => Promise<ReturnType<F>> {
  let chainPromise = Promise.resolve();
  return async function (...args: Parameters<F>) {
    const promiseToAwait = chainPromise;
    const currentLock = new Lock();

    // Set chainPromise before await
    chainPromise = currentLock.promise;

    try {
      await promiseToAwait;
      return await originalFunction(...args);
    } finally {
      currentLock.resolve();
    }
  };
}
