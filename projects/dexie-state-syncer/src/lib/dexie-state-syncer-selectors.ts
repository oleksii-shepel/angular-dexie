import { Observable, OperatorFunction, exhaustMap, from, mergeMap, of } from "rxjs";

export type AnyFn = (...args: any[]) => any;

export interface SelectorFunction {
  (state: any, props: any): any;
}

export interface ProjectionFunction {
  (state: any | any[], props: any): any;
}

export interface MemoizedFunction {
  (...args: any[]): any;
  release: () => any;
}

export interface MemoizedSelectorFunction extends MemoizedFunction, SelectorFunction {

}

export interface MemoizedProjectionFunction extends MemoizedFunction, ProjectionFunction {

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
  projectionOrOptions?: ProjectionFunction | { memoizeSelectors?: AnyFn; memoizeProjection?: AnyFn },
  options: { memoizeSelectors?: AnyFn; memoizeProjection?: AnyFn } = {}
): MemoizedSelector {
  options = (typeof projectionOrOptions !== "function" ? projectionOrOptions : options) || {};

  const isSelectorArray = Array.isArray(selectors);
  const selectorArray: SelectorFunction[] = isSelectorArray ? selectors : [selectors];
  const projection = typeof projectionOrOptions === "function" ? projectionOrOptions : undefined;

  // Default memoization functions if not provided
  const memoizeSelector = options.memoizeSelectors || nomemoize;
  const memoizeProjection = options.memoizeProjection || nomemoize;

  if (isSelectorArray && !projection) {
    throw new Error("Invalid parameters: When 'selectors' is an array, 'projection' function should be provided.");
  }

  // Memoize each selector
  const memoizedSelectors = memoizeSelector === nomemoize ? selectorArray : selectorArray.map(selector => memoizeSelector(selector));
  // If a projection is provided, memoize it; otherwise, use identity function
  const memoizedProjection = projection ? (memoizeProjection === nomemoize ? projection : memoizeProjection(projection)) : undefined;

  // The memoizedSelector function will return a function that executes the selectors and projection
  const memoizedSelector: MemoizedSelector = (state: any, props?: any) => {
    // Execute each selector with the state and props
    const resolvedSelectors = memoizedSelectors
      .map(selector => selector(state, props))
      .map(result => result instanceof Promise || result?.then instanceof Function ? result : Promise.resolve(result));
    // Wait for all the promises to resolve
    return Promise.all(resolvedSelectors).then(values => {
      // Apply the projection function to the resolved values
      return memoizedProjection ? memoizedProjection(...values) : values[0];
    });
  };

  // Optional: Implement a release method if your memoization functions require cleanup
  memoizedSelector.release = () => {
    // Release logic here, if necessary
    memoizedSelectors !== selectorArray && memoizedSelectors.forEach(selector => selector.release());
    projection && memoizedProjection.release();
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


