import { ActionReducer, combineReducers } from '@ngrx/store';
import { Action, createAction } from './dexie-state-syncer-actions';
import { ProfilePage, initialProfilePage } from './dexie-state-syncer-models';


export const initTreeObservable = createAction('INIT_TREE', (obj: any) => {
  return (dispatch: Function, getState?: Function): Promise<any> => {
    const state = getState!();
    if (state && state.writer) {
      return state.writer.initialize(obj);
    } else {
      // Return a resolved Promise when state or state.writer is undefined
      return Promise.resolve(undefined);
    }
  };
});

export const updateTreeObservable = createAction('UPDATE_TREE', (path: string, obj: any) => {
  return (dispatch: Function, getState?: Function): Promise<any> => {
    const state = getState!();
    if (state && state.writer) {
      return state.writer.update(path, obj);
    } else {
      // Return a resolved Promise when state or state.writer is undefined
      return Promise.resolve(undefined);
    }
  };
});


export const updateTreeObservable1 = createAction('UPDATE_TREE1', (path: string, obj: any) => {
  return (dispatch: Function, getState?: Function): Promise<any> => {
    const state = getState!();
    if (state && state.writer) {
      return state.writer.update(path, obj);
    } else {
      // Return a resolved Promise when state or state.writer is undefined
      return Promise.resolve(undefined);
    }
  };
});


export const updateTreeObservable2 = createAction('UPDATE_TREE2', (path: string, obj: any) => {
  return (dispatch: Function, getState?: Function): Promise<any> => {
    const state = getState!();
    if (state && state.writer) {
      return state.writer.update(path, obj);
    } else {
      // Return a resolved Promise when state or state.writer is undefined
      return Promise.resolve(undefined);
    }
  };
});




export const boxed = (value: any) => value !== undefined && value !== null && value.valueOf() !== value;
export const primitive = (value: any) => value === undefined || value === null || typeof value !== 'object';



export const getValue = (obj: any, prop?: string) => {
  if(!prop) { return obj; }
  return prop.split('.').reduce((acc, part) => acc && acc[part], obj);
}



export const setValue = (obj: any, prop: string, val: any): any => {
  if(!prop) { return val; }

  const isArray = (path: string[]) => path.length >= 2 && !isNaN(+path[1]);

  const path = prop.split('.');
  const root = Array.isArray(obj)? [...obj] : {...obj};
  if(path.length === 1) { root[prop] = val; return root; }

  let item = root; let key = path[0];
  while(path.length > 1) {
    item[key] = isArray(path) ? [...(item[key] || [])] : {...item[key]};
    item = item[key];
    path.shift(); key = path[0];
  }
  item[key] = val;
  return root;
}



export function findProps(obj: any): string[] {
  const result: string[] = [];
  if(primitive(obj) || boxed(obj) || Object.keys(obj).length === 0) { return result; }
  const findKeys = (obj: any, prefix = '') => {
    for (const prop in obj) {
      const sub = obj[prop];
      if(primitive(sub) || boxed(sub) || Object.keys(sub).length === 0 || Array.isArray(sub)) {
        result.push(`${prefix}${prop}`)
      }
      else {
        findKeys(sub, `${prefix}${prop}.`);
      }
    }
  }
  findKeys(obj);
  return result;
}




export function deepEqual(x: any, y: any): boolean {
  let equal = false;
  if(x !== null && y !== null && typeof x === 'object' && typeof y === 'object') {
    equal = x === y || x?.valueOf() === y?.valueOf();
    if(!equal) {
      if(x instanceof Map &&  y instanceof Map) {
        equal = x.size === y.size && [...x.entries()].every(([key, value]) => (y.has(key) && deepEqual(y.get(key), value)));
      } else if(x instanceof Set &&  y instanceof Set) {
        equal = x.size === y.size && [...x.entries()].every(([key,]) => y.has(key));
      } else if (Array.isArray(x) && Array.isArray(y)) {
        equal = x.length === y.length && x.reduce<boolean>((isEqual, value, index) => isEqual && deepEqual(value, y[index]), true);
      } else {
        equal = Object.keys(x).length === Object.keys(y).length && Object.keys(x).reduce<boolean>((isEqual, key) => isEqual && deepEqual(x[key], y[key]), true)
      }
    }
  } else {
    equal = x === y;
  }
  return equal;
}



export function deepClone(objectToClone: any) {
  if (primitive(objectToClone)) return objectToClone;

  let obj = undefined;
  if (boxed(objectToClone)) {
    if (objectToClone instanceof Date) { obj = new Date(objectToClone.valueOf()); }
    else { obj = {...objectToClone.constructor(objectToClone.valueOf())}; return obj; }
  }
  else if(objectToClone instanceof Map) { obj = new Map(objectToClone); return obj; }
  else if(objectToClone instanceof Set) { obj = new Set(objectToClone); return obj; }
  else if(Array.isArray(objectToClone)) { obj = [...objectToClone]; }
  else if (typeof objectToClone === 'object') { obj = {...objectToClone}; }

  for (const key in obj) {
    const value = objectToClone[key];
    obj[key] = typeof value === 'object' ? deepClone(value) : value;
  }

  return obj;
}

export interface ApplicationState {
  profile: ProfilePage;
}

export const initialState: ApplicationState = {
  profile: initialProfilePage,
}

/**
 * Because metareducers take a reducer function and return a new reducer,
 * we can use our compose helper to chain them together. Here we are
 * using combineReducers to make our top level reducer, and then
 * wrapping that in storeLogger. Remember that compose applies
 * the result from right to left.
 */

export function profileReducer(state: any, action: Action): ProfilePage {
  switch (action.type) {
    default: {
      return state;
    }
  }
}

export function modelReducer(state: any, action: Action): ProfilePage {
  switch (action.type) {
    default: {
      return state;
    }
  }
}

const reducers = {
  profile: profileReducer,
  model: modelReducer
};

const developmentReducer: ActionReducer<any> = combineReducers(reducers);

export function rootReducer(state: any, action: any) {
  return developmentReducer(state, action);
}
