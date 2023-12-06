import { kindOf } from "./dexie-state-syncer-redux";

export interface Action<T = any> {
  type: string;
  payload?: T;
  error?: boolean;
  meta?: any;
}

export interface AsyncAction<T = any> {
  (): Promise<T>;
}


export type SyncFunction<T> = (dispatch: Function, getState?: Function) => T;
export type AsyncFunction<T> = (dispatch: Function, getState?: Function) => Promise<T>;

export function createAction<T>(type: string, fn: SyncFunction<T> | AsyncFunction<T>) {
  return (dispatch: Function, getState?: Function) => {
    const result = fn(dispatch, getState);
    if (result instanceof Promise && (result as any)?.then instanceof Function) {
      // Handle asynchronous operation
      return result.then(
        (data) => dispatch({ type: `${type}_SUCCESS`, payload: data }),
        (error) => dispatch({ type: `${type}_FAILURE`, payload: error, error: true })
      );
    } else {
      // Handle synchronous operation
      return dispatch({ type, payload: result });
    }
  };
}

// src/bindActionCreators.ts
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
