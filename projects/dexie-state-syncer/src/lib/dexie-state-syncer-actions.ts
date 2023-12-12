import { Observable } from "rxjs";
import { kindOf } from "./dexie-state-syncer-redux";
import { AnyFn } from "./dexie-state-syncer-selectors";

export interface Action<T = any> {
  type: string;
  payload?: T;
  error?: boolean;
  meta?: any;
}

export interface AsyncAction<T = any> {
  (dispatch: Function, getState?: Function): Observable<{
    type: string;
    payload?: T;
    error?: boolean;
    meta?: any;
  }>;
}


export type SyncFunction<T> = (...args: any[]) => (dispatch: Function, getState?: Function) => T;
export type AsyncFunction<T> = (...args: any[]) => (dispatch: Function, getState?: Function) => Promise<T>;

export function createAction<T, P extends any[]>(
  type: string,
  fn: (...args: P) => Promise<T> | T
) {
  return (...args: P) => {
    return async (dispatch: Function, getState?: Function) => {
      try {
        dispatch({ type: `${type}`, payload: args });
        const result = await Promise.resolve(fn(...args));
        const actionResult = await (result as (...args: any[]) => any)(dispatch, getState);
        dispatch({ type: `${type}_SUCCESS`, payload: actionResult });
      } catch (error) {
        dispatch({ type: `${type}_FAILURE`, payload: error, error: true });
      }
    };
  };
}

export function bindActionCreator(actionCreator: Function, dispatch: Function): Function {
  return function(this: any, ...args: any[]): any {
    return dispatch(actionCreator.apply(this, args));
  };
}

export function bindActionCreators(actionCreators: any, dispatch: Function): any {
  if (typeof actionCreators === "function") {
    return bindActionCreator(actionCreators, dispatch);
  }

  if (typeof actionCreators !== "object" || actionCreators === null) {
    throw new Error(`bindActionCreators expected an object or a function, but instead received: '${kindOf(actionCreators)}'. Did you write "import ActionCreators from" instead of "import * as ActionCreators from"?`);
  }

  const keys = Object.keys(actionCreators);
  const numKeys = keys.length;

  if (numKeys === 1) {
    const actionCreator = actionCreators[keys[0]];

    if (typeof actionCreator === "function") {
      return bindActionCreator(actionCreator, dispatch);
    }
  }

  for (let i = 0; i < numKeys; i++) {
    const key = keys[i];
    const actionCreator = actionCreators[key];

    if (typeof actionCreator === "function") {
      actionCreators[key] = bindActionCreator(actionCreator, dispatch);
    }
  }

  return actionCreators;
}
