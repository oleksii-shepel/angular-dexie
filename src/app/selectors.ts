
import { AnyFn, MemoizedFunction, StateDescriptor, createSelector, memoizeStub } from 'dexie-state-syncer';

export function treeMemoize(fn: AnyFn) {
  let cache = {} as any;
  let memoized =  (async (...args: any[]) => {
    let treeDescriptor = args[0] as StateDescriptor, props = args[1];
    let n = await treeDescriptor.data().find(props);
    if (typeof n !== 'undefined' && n.id === cache.id) {
      console.log('Fetching from cache', n.id);
      return cache.result;
    }
    else {
      console.log('Calculating result', args);
      let result = fn(...args);
      if (typeof n !== 'undefined') { cache.id = n.id; cache.result = result; }
      return result;
    }
  }) as MemoizedFunction;

  memoized.release = () => {
    cache = {} as any;
  }

  return memoized;
}

export const selectTree = createSelector(async (state: any, props: any) => state && state.data().get(props), (state) => state, {memoizeSelectors: treeMemoize, memoizeProjector: memoizeStub});
