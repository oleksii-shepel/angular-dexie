import { Observable, OperatorFunction, exhaustMap, from, iif, map, mergeMap, of } from "rxjs";

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


function asyncMemoize(fn: AnyFn): MemoizedFunction {

  if (!(fn instanceof Promise) && !((fn as any)?.then instanceof Function)) {
    return defaultMemoize(fn);
  }

  const cache = new Map<string, Promise<any>>();

  const memoizedFn: MemoizedFunction = (...args: any[]) => {
    const key = args.join(':');

    if (cache.has(key)) {
      return cache.get(key);
    }

    const promise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Function execution timed out'));
      }, 5000); // Timeout after 5 seconds

      try {
        const result = fn(...args);
        clearTimeout(timeout);
        cache.set(key, Promise.resolve(result));
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });

    cache.set(key, promise);
    return promise;
  };

  memoizedFn.release = () => {
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
  projector?: ProjectorFunction,
  {
    memoizeSelectors = asyncMemoize,
    memoizeProjector = defaultMemoize
  }: { memoizeSelectors?: AnyFn; memoizeProjector?: AnyFn } = {}
): MemoizedSelector {
  const isSelectorArray = Array.isArray(selectors);
  const selectorArray: SelectorFunction[] = isSelectorArray ? selectors : [selectors];


  if (isSelectorArray && !projector) {
    throw new Error("Invalid parameters: When 'selectors' is an array, 'projector' function should be provided.");
  }

  const memoizedSelectors = selectorArray.map(selector => memoizeSelectors(selector));
  const memoizedProjector = projector ? memoizeProjector(projector) : undefined;

  // The memoizedSelector function will return a function that returns a Promise
  const memoizedSelector: MemoizedSelector = (props: any, projectorProps?: any) => {
    // Return a function that when called with 'state', will execute the selectors and projector
    return (state: any) => {
      // Use Promise.all to handle both async and sync selectors
      const selectorPromises = memoizedSelectors.map(selector => Promise.resolve(selector(state, props)));
      return Promise.all(selectorPromises).then(resolvedSelectors => {
        // Apply the projector function to the resolved selector values
        // Make sure to pass both the resolvedSelectors and projectorProps to the projector
        return memoizedProjector ? memoizeProjector(...resolvedSelectors, projectorProps) : resolvedSelectors[0];
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


