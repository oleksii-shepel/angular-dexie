
export type AnyFn = (...args: any[]) => any;

export interface SelectorFunction {
  (state: any, props: any): any;
}

export interface ProjectionFunction {
  (state: any | any[], props: any): any;
}

export interface MemoizedFn extends AnyFn {
  (...args: any[]): any;
  release: () => any;
}

const defaultMemoize: AnyFn = (fn: AnyFn): AnyFn => {
  let lastArgs: any[] | undefined = undefined;
  let lastResult: any | undefined = undefined;
  let called = false;

  const resultFunc: MemoizedFn = (...args: any[]): any => {
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

function asyncMemoize(fn: AnyFn): AnyFn {
  let isAsync: boolean | undefined;
  const cache = new Map<string, Promise<any>>();

  const memoizedFn: MemoizedFn = (...args: any[]): any => {
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
  selectors: AnyFn | AnyFn[] | Promise<MemoizedFn> | Promise<MemoizedFn>[],
  projectionOrOptions?: ProjectionFunction | { memoizeSelectors?: AnyFn; memoizeProjection?: AnyFn },
  options: { memoizeSelectors?: AnyFn; memoizeProjection?: AnyFn } = {}
): (props?: any[] | any, projectionProps?: any) => Promise<MemoizedFn> {
  options = (typeof projectionOrOptions !== "function" ? projectionOrOptions : options) || {};

  const isSelectorArray = Array.isArray(selectors);
  const selectorArray: (AnyFn | Promise<MemoizedFn>)[] = isSelectorArray ? selectors : [selectors];
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

  // The createSelectorAsync function will return a function that takes some arguments and returns a Promise that resolves to a SelectorFunction or an array of SelectorFunctions
  return async (props?: any[] | any, projectionProps?: any) => {
    if(!Array.isArray(props)) {
      props = [props];
    }
    // The memoizedSelector function will return a function that executes the selectors and projection
    const fn = async (state: any) => {
      // Execute each selector with the state and props
      const resolvedSelectors = await Promise.all(memoizedSelectors.map(async (selector, index) => {
        const result = await (selector instanceof Promise ? selector : Promise.resolve(selector(state, props[index])));
        return result;
      }));

      if(resolvedSelectors.length === 1) {
        // Apply the projection function to the resolved values
        return memoizedProjection ? memoizedProjection(resolvedSelectors[0], projectionProps) : resolvedSelectors[0];
      } else {
        return memoizedProjection ? memoizedProjection(resolvedSelectors, projectionProps) : undefined;
      }
    };

    const selector = await fn as any;

    // Implement a release method if your memoization functions require cleanup
    selector.release = () => {
      // Release logic here, if necessary
      memoizedSelectors !== selectorArray && memoizedSelectors.forEach(ms => ms.release && ms.release());
      projection && memoizedProjection.release && memoizedProjection.release();
    }

    return selector;
  };
}
