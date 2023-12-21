import { Observable, Subject, concat, defer, first, switchMap } from "rxjs";
import { Action } from "./dexie-state-syncer-actions";
import { Lock } from "./dexie-state-syncer-lock";
import { Middleware, MiddlewareOperator } from "./dexie-state-syncer-redux";

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

// Custom operator that waits for a condition observable to emit true.
export function waitUntil<T>(
  conditionFn: () => Observable<boolean>
): MiddlewareOperator<T> {
  return (source: Observable<T>) => (dispatch: Function, getState: Function) =>
    defer(conditionFn).pipe(
      first((value) => value === true), // Wait until the condition observable emits true
      switchMap(() => source) // Then switch to the source observable
    );
}

export const thunkMiddleware = (): MiddlewareOperator<any> => {
  return (source: any) => (dispatch: Function, getState: Function) => {
    if (typeof source === 'function') {
      if (
        source.constructor.name !== 'GeneratorFunction' &&
        source.constructor.name !== 'AsyncGeneratorFunction'
      ) {
        // Handle thunk
        return source(dispatch, getState);
      }
    }
    // If the source is not a function or is a generator function, return it unmodified
    return undefined;
  };
};

export const sagaMiddleware = <T>(): MiddlewareOperator<T> => {
  const runningSagas = new Map();

  return (
      source: () =>
        | Generator<Promise<any>, void, any>
        | AsyncGenerator<Promise<any>, void, any>
    ) =>
    (dispatch: Function, getState: Function) => {
      if (
        typeof source === 'function' &&
        (source.constructor.name === 'GeneratorFunction' ||
          source.constructor.name === 'AsyncGeneratorFunction')
      ) {
        const sagaName = source.name.toUpperCase(); // Capitalize the saga name

        // If the saga is already running, return
        if (runningSagas.has(sagaName)) {
          // If the saga is already running, return an Observable that completes immediately
          return new Observable((observer) => {
            observer.complete();
          });
        }

        const iterator = source(); // Start the saga
        runningSagas.set(sagaName, iterator); // Add the saga to the map of running sagas

        // Observable for saga
        const sagaObservable = new Observable((observer) => {
          observer.next({ type: `${sagaName}_STARTED` }); // Dispatch SAGA_START action with capitalized saga name
          resolveIterator(iterator);

          async function resolveIterator(
            iterator: AsyncIterator<Promise<any>> | Iterator<Promise<any>>
          ) {
            try {
              const { value, done } = await Promise.resolve(iterator.next());

              if (!done) {
                value.then((result) => {
                  iterator.next(result);
                  resolveIterator(iterator);
                });
              } else {
                runningSagas.delete(sagaName); // Remove the saga from the map of running sagas
                observer.next({ type: `${sagaName}_FINISHED` }); // Dispatch SAGA_FINISHED action with capitalized saga name
                observer.complete(); // Complete the Observable when the saga is done
              }
            } catch (error) {
              observer.error(error);
            }
          }

          // Return teardown logic
          return () => {
            // Handle cleanup if necessary
          };
        });

        return sagaObservable;
      } else {
        return undefined;
      }
    };
};

// Logger middleware as an RxJS operator
export const loggerMiddleware =
  <T>(): MiddlewareOperator<T> =>
  (source: Observable<T>) =>
  (dispatch: Function, getState: Function) =>
    new Observable<T>((observer) => {
      return source.subscribe({
        next: (action) => {
          console.log('[Middleware] Received action:', action);
          observer.next(action);
          console.log('[Middleware] Processed action:', action);
        },
        error: (err) => observer.error(err),
        complete: () => observer.complete(),
      });
    });

function runGenerator<T>(generator: Generator<Promise<T>, T, T>): Promise<T> {
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

