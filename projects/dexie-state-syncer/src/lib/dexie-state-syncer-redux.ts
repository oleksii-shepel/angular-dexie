import { Observable, Observer, Subject, Subscription, UnaryFunction, concatMap, firstValueFrom, from, of, scan, tap } from "rxjs";
import { Action, AsyncAction } from "./dexie-state-syncer-actions";
import { AsyncObserver, CustomAsyncSubject, toObservable } from "./dexie-state-syncer-behaviour-subject";
import { AnyFn } from "./dexie-state-syncer-selectors";

function isAction(action: any): boolean {
  return isPlainObject(action) && "type" in action && typeof action.type === "string";
}

function isPlainObject(obj: any): boolean {
  if (typeof obj !== "object" || obj === null)
    return false;

  let proto = obj;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }

  return Object.getPrototypeOf(obj) === proto;
}

const randomString = (): string => Math.random().toString(36).substring(7).split("").join(".");

const ActionTypes = {
  INIT: `@@redux/INIT${/* @__PURE__ */ randomString()}`,
  REPLACE: `@@redux/REPLACE${/* @__PURE__ */ randomString()}`,
  PROBE_UNKNOWN_ACTION: (): string => `@@redux/PROBE_UNKNOWN_ACTION${randomString()}`
};

const actionTypes_default = ActionTypes;

function kindOf(val: any): string {
  if (val === undefined)
    return "undefined";
  if (val === null)
    return "null";

  const type = typeof val;
  switch (type) {
    case "boolean":
    case "string":
    case "number":
    case "symbol":
    case "function": {
      return type;
    }
  }

  if (Array.isArray(val))
    return "array";

  if (isDate(val))
    return "date";

  if (isError(val))
    return "error";

  const constructorName = ctorName(val);
  switch (constructorName) {
    case "Symbol":
    case "Promise":
    case "WeakMap":
    case "WeakSet":
    case "Map":
    case "Set":
      return constructorName;
  }

  return Object.prototype.toString.call(val).slice(8, -1).toLowerCase().replace(/\s/g, "");
}

function ctorName(val: any): string {
  return typeof val.constructor === "function" ? val.constructor.name : null;
}

function isError(val: any): boolean {
  return val instanceof Error || typeof val.message === "string" && val.constructor && typeof val.constructor.stackTraceLimit === "number";
}

function isDate(val: any): boolean {
  if (val instanceof Date)
    return true;

  return typeof val.toDateString === "function" && typeof val.getDate === "function" && typeof val.setDate === "function";
}

export type Reducer<T> = (state: T | undefined, action: Action<any>) => T | undefined


export type SideEffect = Generator<Action<any>, void, unknown>;


export interface FeatureModule {
  slice: string;
  state: any;
  reducer: Reducer<any>;
  sideEffects: SideEffect[];
}

export interface MainModule {
  transformers: MiddlewareOperator<any>[];
  processors: MiddlewareOperator<any>[];
  reducers: Record<string, Reducer<any>>;
  sideEffects: SideEffect[];
}

export interface Store<K> extends MainModule {
  dispatch: (action: AsyncAction<any> | Action<any>) => any;
  getState: () => K;
  replaceReducer: (newReducer: Reducer<any>) => void;
  pipe: (...operators: Array<UnaryFunction<Observable<K>, Observable<any>>>) => Observable<any>;
  subscribe: (next?: AnyFn | Observer<any>, error?: AnyFn, complete?: AnyFn) => Promise<Subscription>;
  subscription: Subscription;
}


// Define the initial state and actions
const initialState = { modules: [] };
const actions = {
  INIT_STORE: 'INIT_STORE',
  LOAD_MODULE: 'LOAD_MODULE',
  UNLOAD_MODULE: 'UNLOAD_MODULE',
  ENABLE_TRANSFORMERS: 'ENABLE_TRANSFORMERS',
  SETUP_PROCESSORS: 'SETUP_PROCESSORS',
  REGISTER_EFFECTS: 'REGISTER_EFFECTS',
  UNREGISTER_EFFECTS: 'UNREGISTER_EFFECTS'
};

// Define the action creators
const actionCreators = {
  initStore: (module: MainModule) => ({ type: actions.INIT_STORE, payload: module }),
  loadModule: (module: FeatureModule) => ({ type: actions.LOAD_MODULE, payload: module }),
  unloadModule: (module: FeatureModule) => ({ type: actions.UNLOAD_MODULE, payload: module }),
  enableTransformers: (transformers: MiddlewareOperator<any>[]) => ({ type: actions.ENABLE_TRANSFORMERS, payload: transformers }),
  setupProcessors: (processors: MiddlewareOperator<any>[]) => ({ type: actions.SETUP_PROCESSORS, payload: processors }),
  registerEffects: (effects: SideEffect[]) => ({ type: actions.REGISTER_EFFECTS, payload: effects }),
  unregisterEffects: (effects: SideEffect[]) => ({ type: actions.UNREGISTER_EFFECTS, payload: effects }),
};

// Define the reducer
export function supervisor<K>(mainModule: MainModule) {
  return (createStore: StoreCreator<K>) => (reducer: Reducer<any>, preloadedState?: K | undefined, enhancer?: Function) => {
    // Create the store as usual
    const store = createStore(reducer, preloadedState, enhancer);

    // Enhance the dispatch function
    const originalDispatch = store.dispatch;
    store.dispatch = (action: Action<any> | AsyncAction<any>) => {
      if (typeof action === 'function') {
        // Handle AsyncAction
        return action(store.dispatch, store.getState);
      } else {
        // Handle Action
        let result = originalDispatch(action);

        // Handle specific actions
        switch (action.type) {
          case actions.ENABLE_TRANSFORMERS:
            enableTransformers(store, action.payload);
            break;
          case actions.SETUP_PROCESSORS:
            setupProcessors(store, action.payload);
            break;
          case actions.REGISTER_EFFECTS:
            registerEffects(store, action.payload);
            break;
          case actions.UNLOAD_MODULE:
            unloadModule(store, action.payload);
            break;
          case actions.UNREGISTER_EFFECTS:
            unregisterEffects(store, action.payload);
            break;
          default:
            break;
        }

        return result;
      }
    };

    // Initialize the store with the main module
    store.dispatch(actionCreators.initStore(mainModule));
    store.dispatch(actionCreators.enableTransformers(mainModule.transformers));
    store.dispatch(actionCreators.setupProcessors(mainModule.processors));
    store.dispatch(actionCreators.registerEffects(mainModule.sideEffects));

    return store;
  };
}

async function isActionObservable(obj: any): Promise<boolean> {
  if (obj instanceof Observable) {
    let isAction = false;
    try {
      await firstValueFrom(
        obj.pipe(
          tap(value => {
            if (typeof value === 'object' && typeof value.type === 'string') {
              isAction = true;
            }
          })
        )
      );
    } catch (error) {
      console.error(error);
    }
    return isAction;
  } else {
    return false;
  }
}

export type StoreCreator<K> = (reducer: Reducer<any>, preloadedState?: K | undefined, enhancer?: Function) => Store<any>;


function createStore<K>(reducer: Reducer<any>, preloadedState?: K | undefined, enhancer?: Function): Store<K> {
  let transformers: any;
  let processors: any;
  let reducers: Record<string, Reducer<any>> = {};
  let sideEffects: SideEffect[] = [];

  let store = { dispatch, getState, replaceReducer, pipe, subscribe, transformers, processors, reducers, sideEffects} as any;
  let actionStream = new Subject<Observable<Action<any>> | AsyncAction<any>>();
  let currentState = new CustomAsyncSubject<K>(preloadedState as K);
  let currentReducer = reducer;
  let isDispatching = false;

  if (typeof reducer !== "function") {
    throw new Error(`Expected the root reducer to be a function. Instead, received: '${kindOf(reducer)}'`);
  }

  if ((typeof preloadedState === "function" && typeof enhancer === "function") || (typeof enhancer === "function" && typeof arguments[3] === "function")) {
    throw new Error("It looks like you are passing several store enhancers to createStore(). This is not supported. Instead, compose them together to a single function. See https://redux.js.org/tutorials/fundamentals/part-4-store#creating-a-store-with-enhancers for an example.");
  }

  if (typeof preloadedState === "function" && typeof enhancer === "undefined") {
    enhancer = preloadedState;
    preloadedState = undefined;
  }

  if (typeof enhancer !== "undefined") {
    if (typeof enhancer !== "function") {
      throw new Error(`Expected the enhancer to be a function. Instead, received: '${kindOf(enhancer)}'`);
    }
    store = enhancer(createStore)(reducer, preloadedState);
  }

  const pipeline = store.middlewares || ((source: Observable<any>) => [(dispatch: Function, getState: Function) => source]);
  const subscription = actionStream.pipe(
    concatMap(action => pipeline(action)),
    tap(() => isDispatching = true),
    scan((state, action: any) => currentReducer(state, action), currentState.value),
    concatMap((state: any) => from(currentState.next(state))),
    tap(() => isDispatching = false)
  ).subscribe();

  function getState(): K {
    return currentState.value;
  }

  async function subscribe(next?: AnyFn | Observer<any>, error?: AnyFn, complete?: AnyFn): Promise<Subscription> {
    if (typeof next === 'function') {
      return await currentState.subscribe({next, error, complete});
    } else {
      return await currentState.subscribe(next as Partial<AsyncObserver<any>>);
    }
  }

  function dispatch(action: AsyncAction<any> | Action<any>): any {
    if (typeof action === 'function') {
      // If the action is a function, it's an AsyncAction
      actionStream.next(action);
    } else if (typeof action === 'object' && action.type) {
      // If the action is an object, it's an Action
      actionStream.next(of(action));
    }
  }

  function replaceReducer(nextReducer: Reducer<any>): void {
    if (typeof nextReducer !== "function") {
      throw new Error(`Expected the nextReducer to be a function. Instead, received: '${kindOf(nextReducer)}`);
    }
    currentReducer = nextReducer;
    dispatch({
      type: actionTypes_default.REPLACE
    });
  }

  function pipe(...operators: Array<UnaryFunction<Observable<K>, Observable<any>>>): Observable<any> {
    return operators.reduce((source, operator) => operator(source), toObservable<K>(currentState));
  }

  dispatch({
    type: actionTypes_default.INIT
  });

  return {
    transformers,
    processors,
    reducers,
    sideEffects,
    dispatch,
    getState,
    replaceReducer,
    pipe,
    subscribe,
    subscription
  }
}

function loadModule(store: Store<any>, module: FeatureModule) {
  // Combine the module's reducer with the current reducers
  const newReducers = { ...store.reducers, [module.slice]: module.reducer };
  const newRootReducer = combineReducers(newReducers);

  // Replace the store's reducer
  store.replaceReducer(newRootReducer);
  store.dispatch(actionCreators.registerEffects(module.sideEffects));
}

function unloadModule(store: Store<any>, module: FeatureModule) {
  // Remove the module's reducer from the current reducers
  const {[module.slice]: _, ...remainingReducers} = store.reducers;

  // Replace the store's reducer
  store.replaceReducer(combineReducers(remainingReducers));
  store.dispatch(actionCreators.unregisterEffects(module.sideEffects));
}


function assertReducerShape(reducers: any): void {
  const reducerKeys = Object.keys(reducers);

  for (const key of reducerKeys) {
    const reducer = reducers[key];
    const initialState = reducer(undefined, {
      type: actionTypes_default.INIT
    });

    if (typeof initialState === "undefined") {
      throw new Error(`The slice reducer for key "${key}" returned undefined during initialization. If the state passed to the reducer is undefined, you must explicitly return the initial state. The initial state may not be undefined. If you don't want to set a value for this reducer, you can use null instead of undefined.`);
    }

    if (typeof reducer(undefined, {
      type: actionTypes_default.PROBE_UNKNOWN_ACTION()
    }) === "undefined") {
      throw new Error(`The slice reducer for key "${key}" returned undefined when probed with a random type. Don't try to handle '${actionTypes_default.INIT}' or other actions in "redux/*" namespace. They are considered private. Instead, you must return the current state for any unknown actions, unless it is undefined, in which case you must return the initial state, regardless of the action type. The initial state may not be undefined, but can be null.`);
    }
  }
}

function combineReducers(reducers: Record<string, Reducer<any>>): Reducer<any> {
  const reducerKeys = Object.keys(reducers);
  const finalReducers: any = {};

  for (const key of reducerKeys) {
    if (typeof reducers[key] === "function") {
      finalReducers[key] = reducers[key];
    }
  }

  const finalReducerKeys = Object.keys(finalReducers);

  return function combination(state = {} as any, action: any): any {
    assertReducerShape(finalReducers);

    const nextState: any = {};
    let hasChanged = false;

    for (const key of finalReducerKeys) {
      const reducer = finalReducers[key];
      const previousStateForKey = state[key];
      const nextStateForKey = reducer(previousStateForKey, action);

      if (typeof nextStateForKey === "undefined") {
        const actionType = action && action.type;
        throw new Error(`When called with an action of type ${actionType ? `"${String(actionType)}"` : "(unknown type)"}, the slice reducer for key "${key}" returned undefined. To ignore an action, you must explicitly return the previous state. If you want this reducer to hold no value, you can return null instead of undefined.`);
      }

      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;

      if (hasChanged) {
        break;
      }
    }

    if (!hasChanged && finalReducerKeys.length === Object.keys(state).length) {
      return state;
    }

    return nextState;
  };
}

function compose(...funcs: Function[]): Function {
  if (funcs.length === 0) {
    return (arg: any): any => arg;
  }

  if (funcs.length === 1) {
    return funcs[0];
  }

  return funcs.reduce((a, b) => (...args: any[]) => a(b(...args)));
}

export interface Middleware {
  (store: any): (next: (action: any) => any) => Promise<(action: any) => any> | any;
}

export type MiddlewareOperator<T> = (source: Observable<T>) => (dispatch: Function, getState: Function) => Observable<any>;

// applyMiddleware function that accepts operator functions
function applyMiddleware(...operators: MiddlewareOperator<any>[]) {
  return (createStore: Function) => (reducer: Reducer<any>, preloadedState?: any) => {
    const store = createStore(reducer, preloadedState);

    // Create a pipeline function that takes dispatch and getState
    const middlewares = (source: Observable<any>) => {
      return operators.reduce((result, fn) => {
        return fn(result)(store.dispatch, store.getState);
      }, source);
    };

    return {
      ...store,
      middlewares
    };
  };
}

// applyTransformers function that accepts operator functions
function enableTransformers(store: Store<any>, ...operators: MiddlewareOperator<any>[]) {
  // Create a pipeline function that takes dispatch and getState
  const transformers  = (source: Observable<any>) => {
    return operators.reduce((result, fn) => {
      return fn(result)(store.dispatch, store.getState);
    }, source);
  };

  // Enhance the store with transformers
  store.transformers = transformers as any;
}

function setupProcessors(store: Store<any>, ...operators: MiddlewareOperator<any>[]) {
  // Create a pipeline function that takes dispatch and getState
  const processors = (source: Observable<any>) => (dispatch: Function, getState: Function) => {
    return operators.reduce((result, fn) => {
      return fn(result)(dispatch, getState);
    }, source);
  };

  // Enhance the store with processors
  store.processors = processors as any;
}

function registerEffects(store: Store<any>, ...sideEffects: SideEffect[]) {
  store.sideEffects = [...store.sideEffects, ...sideEffects];
}

function unregisterEffects(store: Store<any>, ...sideEffects: SideEffect[]) {
  // Remove the effects from the store's sideEffects array
  store.sideEffects = store.sideEffects.filter(effect => !sideEffects.includes(effect));
}


export {
  actionTypes_default as __DO_NOT_USE__ActionTypes,
  applyMiddleware, combineReducers, compose, createStore, enableTransformers, isAction, isPlainObject, kindOf, loadModule, registerEffects, setupProcessors, unloadModule, unregisterEffects
};

