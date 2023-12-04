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
  let lastArgs: any[] | null = null;
  let lastResult: any | null = null;
  let called = false;

  const resultFunc: MemoizedFunction = (...args: any[]): any => {
    if (called && lastArgs !== null && args.every((arg, index) => arg === lastArgs![index])) {
      return lastResult;
    }
    lastResult = fn(...args);
    lastArgs = args;
    called = true;
    return lastResult;
  };

  resultFunc.release = () => {
    lastArgs = null;
    lastResult = null;
    called = false;
  };

  return resultFunc;
};

function asyncMemoize(fn: AnyFn): MemoizedFunction {
  const cache = new Map<string, any>();
  const pendingResults = new Map<string, Promise<any>>();

  const memoizedFn: MemoizedFunction = async (...args: any[]) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }

    if (pendingResults.has(key)) {
      return pendingResults.get(key);
    }

    const promise = fn(...args).then(
      (result: any) => {
        cache.set(key, result);
        pendingResults.delete(key);
        return result;
      },
      (error: any)  => {
        pendingResults.delete(key);
        throw error;
      }
    );

    pendingResults.set(key, promise);
    return promise;
  };

  memoizedFn.release = () => {
    cache.clear();
    pendingResults.clear();
  };

  return memoizedFn;
}

export function memoizeStub(fn: AnyFn) {
  const func = (...args: any[]) => fn(...args);
  func.release = () => { Function.prototype };
  return func;
}

export function createSelector(
  selectors: SelectorFunction | SelectorFunction[],
  projector: ProjectorFunction,
  options: { memoizeSelectors?: AnyFn; memoizeProjector?: AnyFn } = {}
): MemoizedSelector {
  const { memoizeSelectors = asyncMemoize, memoizeProjector = defaultMemoize } = options;

  const selectorArray: SelectorFunction[] = Array.isArray(selectors) ? selectors : [selectors];
  const memoizedSelectors: MemoizedFunction[] = selectorArray.map(selector => memoizeSelectors(selector));
  const memoizedProjector: MemoizedFunction = memoizeProjector(projector);

  const memoizedSelector: MemoizedSelector = async (state: any, props?: any) => {
    const selectorResults: any[] = await Promise.all(memoizedSelectors.map(selector => selector(state, props)));
    return memoizedProjector(...selectorResults, props);
  };

  memoizedSelector.release = () => {
    memoizedSelectors.forEach(selector => selector.release());
    memoizedProjector.release();
  };

  return memoizedSelector;
}

