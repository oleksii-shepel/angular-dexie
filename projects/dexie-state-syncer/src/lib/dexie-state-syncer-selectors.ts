import { Observable, OperatorFunction, exhaustMap, from, mergeMap, of } from "rxjs";

export type AnyFn = (...args: any[]) => any;

export interface SelectorFunction {
  (state: any, props: any): any;
}

export interface ProjectorFunction {
  (state: any | any[], props: any): any;
}

export interface MemoizedFunction {
  (...args: any[]): any;
  release: () => any;
}

export interface MemoizedSelectorFunction extends MemoizedFunction, SelectorFunction {

}

export interface MemoizedProjectorFunction extends MemoizedFunction, ProjectorFunction {

}

export interface MemoizedSelector extends MemoizedFunction {
  (props: any | any[], projectorProps?: any): Promise<(state: any) => any> | any;
  release: () => any;
}


const defaultMemoize: AnyFn = (fn: AnyFn): MemoizedFunction => {
  let lastArgs: any[] | undefined = undefined;
  let lastResult: any | undefined = undefined;
  let called = false;

  const resultFunc: MemoizedFunction = (...args: any[]): any => {
    if (called && lastArgs !== undefined && args.length === lastArgs.length) {
      let argsEqual = true;
      for (let i = 0; i < args.length; i++) {
        if (args[i] !== lastArgs[i]) {
          argsEqual = false;
          break;
        }
      }
      if (argsEqual) {
        return lastResult;
      }
    }

    try {
      const result = fn(...args);
      lastResult = result;
      // Create a shallow copy of the args array to prevent future mutations from affecting the memoization
      lastArgs = [...args];
      called = true;
      return result;
    } catch (error) {
      // Handle error here
      throw error;
    }
  };

  resultFunc.release = () => {
    lastArgs = undefined;
    lastResult = undefined;
    called = false;
  };

  return resultFunc;
};

const prune = (obj: any, depth = 1): any => {
  if (Array.isArray(obj) && obj.length > 0) {
    // If it's an array and not empty, map through its elements and prune each one
    return (depth === 0) ? ['???'] : obj.map(e => prune(e, depth - 1));
  } else if (obj && typeof obj === 'object' && Object.keys(obj).length > 0) {
    // If it's an object and not empty, reduce its keys to a new object with pruned values
    return (depth === 0) ? {'???': ''} : Object.keys(obj).reduce((acc, key) => ({ ...acc, [key]: prune(obj[key], depth - 1) }), {});
  } else {
    // If it's neither an array nor an object, or it's empty, return it as is
    return obj;
  }
}


const stringify = (obj: any, depth = 1, space: number) => JSON.stringify(prune(obj, depth), null, space);

function asyncMemoize(fn: AnyFn): MemoizedFunction {
  let isAsync: boolean | undefined;
  const cache = new Map<string, Promise<any>>();

  const memoizedFn: MemoizedFunction = (...args: any[]): any => {
    const key = stringify(args, 2, 0);

    if (cache.has(key)) {
      return cache.get(key);
    }

    // Determine if the function is async only on the first call
    if (isAsync === undefined) {
      const result = fn(...args);
      isAsync = result instanceof Promise && result?.then instanceof Function;
      // If the function is not async, use defaultMemoize
      if (!isAsync) {
        const defaultMemoizedFn: AnyFn = defaultMemoize(fn);
        return defaultMemoizedFn(...args);
      }
    }

    // If the function is async, proceed with memoization
    const promise = (async () => {
      try {
        const result = await fn(...args);
        cache.set(key, Promise.resolve(result));
        return result;
      } catch (error) {
        cache.delete(key); // Remove from cache if there's an error
        throw error;
      }
    })();

    cache.set(key, promise);
    return promise;
  };

  memoizedFn.release = (): void => {
    cache.clear();
  };

  return memoizedFn;
}

export function nomemoize(fn: AnyFn) {
  const func = (...args: any[]) => fn(...args);
  func.release = () => { Function.prototype };
  return func;
}

export function createSelector(
  selectors: SelectorFunction | SelectorFunction[],
  projectorOrOptions?: ProjectorFunction | { memoizeSelectors?: AnyFn; memoizeProjector?: AnyFn },
  options: { memoizeSelectors?: AnyFn; memoizeProjector?: AnyFn } = {}
): MemoizedSelector {
  const isSelectorArray = Array.isArray(selectors);
  const selectorArray: SelectorFunction[] = isSelectorArray ? selectors : [selectors];

  let projector: ProjectorFunction | undefined;
  let memoizeSelectors: AnyFn;
  let memoizeProjector: AnyFn;

  if (typeof projectorOrOptions === 'function') {
    projector = projectorOrOptions;
    memoizeSelectors = options.memoizeSelectors || asyncMemoize;
    memoizeProjector = options.memoizeProjector || defaultMemoize;
  } else {
    memoizeSelectors = (projectorOrOptions && projectorOrOptions.memoizeSelectors) || asyncMemoize;
    memoizeProjector = (projectorOrOptions && projectorOrOptions.memoizeProjector) || defaultMemoize;
  }

  if (isSelectorArray && !projector) {
    throw new Error("Invalid parameters: When 'selectors' is an array, 'projector' function should be provided.");
  }

  const memoizedSelectors = selectorArray.map(selector => memoizeSelectors(selector));
  const memoizedProjector = projector ? memoizeProjector(projector) : (result: any) => result;

  // The memoizedSelector function will return a function that returns a Promise
  const memoizedSelector: MemoizedSelector = (props: any, projectorProps?: any) => {
    // Return a function that when called with 'state', will execute the selectors and projector
    return (state: any) => {
      // Use Promise.all to handle both async and sync selectors
      const selectorPromises = memoizedSelectors.map(selector => Promise.resolve(selector(state, props)));
      return Promise.all(selectorPromises).then(resolvedSelectors => {
        // Apply the projector function to the resolved selector values
        // Make sure to pass both the resolvedSelectors and projectorProps to the projector
        return memoizedProjector(...resolvedSelectors, projectorProps);
      });
    };
  };

  memoizedSelector.release = () => {
    memoizedSelectors.forEach(selector => selector.release());
    projector && memoizedProjector.release();
  };

  return memoizedSelector;
}

export function select<T, K>(selector: ((state: T) => K) | Promise<K>): OperatorFunction<T, K> {
  return (source: Observable<T>): Observable<K> => {
    return source.pipe(
      exhaustMap(state => {
        if (selector instanceof Promise) {
          // Resolve the promise and then emit its value
          return from(selector).pipe(
            mergeMap(resolvedValue => of(resolvedValue))
          );
        } else {
          // 'selector' is a function, call it directly
          return of(selector(state));
        }
      })
    );
  };
}


