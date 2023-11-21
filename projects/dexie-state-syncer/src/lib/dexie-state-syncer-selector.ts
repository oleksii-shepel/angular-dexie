import { isDevMode } from '@angular/core';

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
  (props: any | any[], projectorProps?: any): (state: any) => any;
  release: () => any;
}



export function makeCRCTable(){
  var c;
  var crcTable = [];
  for(var n =0; n < 256; n++){
      c = n;
      for(var k =0; k < 8; k++){
          c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      }
      crcTable[n] = c;
  }
  return crcTable;
}

const crcTable = makeCRCTable();

export function crc32(str: string) {

  var crc = 0 ^ (-1);

  for (var i = 0; i < str.length; i++ ) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
  }

  return (crc ^ (-1)) >>> 0;
}

export function flattenObject(obj: any) {
  var toReturn = {} as any;

  for (var i in obj) {
      if (!obj.hasOwnProperty(i)) continue;

      if ((typeof obj[i]) == 'object') {
          var flatObject = flattenObject(obj[i]);
          for (var x in flatObject) {
              if (!flatObject.hasOwnProperty(x)) continue;

              toReturn[i + '.' + x] = flatObject[x];
          }
      } else {
          toReturn[i] = obj[i];
      }
  }
  return toReturn;
}

export function memoize(fn: AnyFn) {
  let cache = {} as any;
  let memoized = ((...args: any[]) => {
    let obj = flattenObject(args)
    let n = crc32(JSON.stringify(obj, Object.keys(obj).sort()));
    if (n in cache) {
      console.log('Fetching from cache', n);
      return cache[n];
    }
    else {
      console.log('Calculating result', args);
      let result = fn(...args);
      cache[n] = result;
      return result;
    }
  }) as MemoizedFunction;

  memoized.release = () => {
    cache = {} as any;
  }

  return memoized;
}

export function memoizeStub(fn: AnyFn) {
  const func = (...args: any[]) => fn(...args);
  func.release = () => { Function.prototype };
  return func;
}

export function createSelector(selectors: SelectorFunction | SelectorFunction[], projector: ProjectorFunction, options: {memoizeSelectors? : AnyFn, memoizeProjector?: AnyFn} = {}) {
  const memoizeSelectors = options.memoizeSelectors ?? memoize;
  const memoizeProjector = options.memoizeProjector ?? memoize;

  if (!Array.isArray(selectors)) selectors = [selectors];
  const memoizedSelectors = selectors.map(selector => memoizeSelectors!(selector)) as MemoizedSelectorFunction[];
  const memoizedProjector = memoizeProjector!(projector) as MemoizedProjectorFunction;

  const selector = ((props: any | any[], projectorProps?: any) => (state: any) => {
    if (!Array.isArray(props)) props = [props];
    let args = memoizedSelectors.map((selector, index) => selector(state, props[index]));
    return memoizedProjector(...args, projectorProps);
  }) as MemoizedSelector;

  selector.release = () => {
    memoizedSelectors.forEach(selector => selector.release());
    memoizedProjector.release();
  }

  return selector;
}

export function createFeatureSelector (
  featureName: string,
): MemoizedSelector {
 return createSelector((state: any) => {
      const featureState = state[featureName];
      return featureState;
    },
    (featureState: any) => featureState
  );
}

