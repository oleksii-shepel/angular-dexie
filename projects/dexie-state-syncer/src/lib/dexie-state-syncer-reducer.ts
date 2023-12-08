import { ProfilePage, initialProfilePage } from './dexie-state-syncer-models';
import { Action, ActionReducer, combineReducers } from '@ngrx/store';
import { ObjectState, createAction } from 'dexie-state-syncer';

export enum FormActions {
  UpdateForm = '@forms/form/update',
  UpdateControl = '@forms/form/control/update',
}

export enum FormActionsInternal {
  AutoInit = '@forms/form/init',
  AutoSubmit = '@forms/form/submit',
  FormDestroyed = '@forms/form/destroyed',
}

export const initTree = createAction(FormActionsInternal.AutoInit, (obj: any) => async (dispatch: Function, getState?: Function) => {
  const tree = getState!() as ObjectState;
  const result = await tree.descriptor().writer.initialize(obj);
  return result;
});

export const updateTree = createAction(FormActions.UpdateForm, (path: string, obj: any) => async (dispatch: Function, getState?: Function) => {
  const tree = getState!() as ObjectState;
  const result = await tree.descriptor().writer.update(path, obj);
  return result;
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

export const forms = (initialState: any, logging: {showAll?: boolean, showRegular?: boolean, showDeferred?: boolean, showOnlyModifiers?: boolean, showMatch?: RegExp} = {}) => (reducer: ActionReducer<any>): any => {

  const metaReducer = async (state: any, action: any) => {
    state = state ? state: initialState;
    let writer = state.descriptor().writer;

    console.log('state', state);
    console.log('action', action);

    if(action.type === FormActionsInternal.AutoInit) {
      await writer.initialize({
        a: 'sdsd',
        b: {
          c: 'asd',
          d: 'sadf',
          e : {
            f: 'dfasdasdasd',
            g: 'gevrevre'
          }
        },
        i: {
          j: 'dsfsdf'
        },
        k: 'sadas'
      });
      return state;
    } else if(action.type === FormActions.UpdateForm) {
      await writer.update('b', {
        c: 'asd',
        d: 'sadf',
        e : {
          f: 'dfasdasdasd',
          g: 'gevrevre'
        }
      });
      return state;
    }
    //return reducer(state, action);
    return state;
  }

  return metaReducer;
}


export const logger = (settings: {showAll?: boolean, showRegular?: boolean, showDeferred?: boolean, showOnlyModifiers?: boolean, showMatch?: RegExp}) => (state: any, nextState: any, action: any) => {
  settings = Object.assign({showAll: false, showRegular: false, showDeferred: false, showOnlyModifiers: true}, settings);

  function filter(action: any, equal: any): boolean {
    let show = false;
    if(settings.showMatch && action.type.match(settings.showMatch)) {
      show = true;
    }
    if(settings.showRegular && !action.deferred) {
      show = true;
    }
    if(settings.showDeferred && action.deferred) {
      show = true;
    }
    if(settings.showOnlyModifiers && !equal) {
      show = true;
    }
    if(settings.showAll) {
      show = true;
    }
    return show;
  }

  const actionCopy = deepClone(action);
  delete actionCopy.type;

  const actionPath = actionCopy?.path ?? '';
  delete actionCopy?.path;

  const before = actionPath.length > 0 ? getValue(state, actionPath) : state;
  const after = actionPath.length > 0 ? getValue(nextState, actionPath) : nextState;
  const equal = deepEqual(before, after);

  if(filter(action, equal)) {
    console.groupCollapsed("%c%s%c", action.deferred ? "color: blue;" : "color: black;", action.type, "color: black;");
    console.log("path: '%c%s%c', payload: %o", "color: red;", actionPath, "color: black;", actionCopy);
    console.log(after);
    console.groupEnd();
  }
  return nextState;
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
