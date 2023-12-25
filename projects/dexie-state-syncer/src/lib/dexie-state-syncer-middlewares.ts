import { EMPTY, Observable, Subject, concat, defer, first, switchMap } from "rxjs";
import { Action, AsyncAction } from "./dexie-state-syncer-actions";
import { Lock } from "./dexie-state-syncer-lock";
import { Middleware, MiddlewareOperator, Store } from "./dexie-state-syncer-redux";

export function sequential(middleware: Middleware): Middleware {
  const lock = new Lock();

  return ({ dispatch, getState }) => (next) => async (action: Action<any>) => {
    await lock.acquire();

    try {
      await middleware({ dispatch, getState })(next)(action);
    } finally {
      lock.release();
    }
  };
}

export function waitUntil(conditionFn: () => Observable<boolean>): MiddlewareOperator {
  return (store: Store) => (next: Function) => (action: Action<any> | AsyncAction<any>) =>
    defer(conditionFn).pipe(
      first((value) => value === true),
      switchMap(() => next(action))
    );
}

export const thunkMiddleware: MiddlewareOperator = (store: Store) => {
  return (next: Function) => (action: Action<any> | AsyncAction<any>) => {
    if (typeof action === 'function') {
        return next(action(store.dispatch, store.getState));
    }
    return next(action);
  };
};


export const sagaMiddleware: MiddlewareOperator & { runningSagas: Map<string, any> } = (store: Store) => {
  let runningSagas = sagaMiddleware.runningSagas;

  return (next: Function) => (action: Action<any> | AsyncAction<any>) => {
    // Call next(action) before running sagas
    const result = next(action);

    const sagas$ = store.pipeline.effects.map(effect => {
      if (
        typeof effect === 'function' &&
        (effect.constructor.name === 'GeneratorFunction' ||
          effect.constructor.name === 'AsyncGeneratorFunction')
      ) {
        const sagaName = effect.name.toUpperCase();

        if (runningSagas.has(sagaName)) {
          return EMPTY; // Return a completed Observable
        }

        function resolveIterator(effect: Function, sagaName: string) {
          const iterator = effect();

          return new Observable(observer => {
            async function processIterator() {
              // Dispatch STARTED action
              observer.next({ type: `${sagaName}_STARTED` });

              let next = iterator.next();
              while (!next.done) {
                const value = await next.value;
                observer.next(value);
                next = iterator.next();
              }

              // Dispatch FINISHED action
              observer.next({ type: `${sagaName}_FINISHED` });
              observer.complete();
            }
            processIterator();
          });
        }

        const saga$ = resolveIterator(effect, sagaName);
        runningSagas.set(sagaName, saga$);
        return saga$;
      } else {
        return EMPTY; // Return a completed Observable
      }
    });

    // Merge the result of next(action) and all the saga Observables
    return concat(result, ...sagas$);
  };
};


sagaMiddleware.runningSagas = new Map();

export const loggerMiddleware: MiddlewareOperator = (store: Store) => {
  return (next: Function) => (action: Action<any> | AsyncAction<any>) => {
    console.log('dispatching', action);
    let result = next(action);
    console.log('next state', store.getState());
    return result;
  };
};

export function runGenerator<T>(generator: Generator<Promise<T>, T, T>): Promise<T> {
  return new Promise((resolve, reject) => {
    function step({ value, done }: IteratorResult<Promise<T>, T>) {
      const promise: Promise<T> = Promise.resolve(value);
      if (done) {
        resolve(promise);
      } else {
        promise.then(
          (result) => step(generator.next(result)),
          (error) => step(generator.throw(error))
        );
      }
    }
    step(generator.next());
  });
}

export function adaptMiddleware(
  middleware: any
): (
  source: Observable<any>
) => (dispatch: Function, getState: Function) => Observable<any> {
  return (source: Observable<any>) =>
    (dispatch: Function, getState: Function) => {
      // Create a 'next' function that pushes actions into a Subject
      const actionSubject = new Subject<any>();
      const next = (action: any) => actionSubject.next(action);

      // Call the Redux middleware with a fake 'store'
      const middlewareOutput = middleware({ getState, dispatch })(next);

      // Return an Observable that first runs the middleware, then emits actions from the Subject
      return concat(
        defer(() => middlewareOutput(source)),
        actionSubject.asObservable()
      );
    };
}

