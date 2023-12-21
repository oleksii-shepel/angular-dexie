import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { Action, InMemoryObjectState, MainModule, MiddlewareOperator, Reducer, StoreModule, combineReducers, createStore, supervisor } from 'dexie-state-syncer';
import { Observable, Subject, concat, defer, first, switchMap } from 'rxjs';

import { RouterModule, Routes } from '@angular/router';
import { AppComponent } from './app.component';

export const tree = new InMemoryObjectState();

// Custom operator that waits for a condition observable to emit true.
export function waitUntil<T>(conditionFn: () => Observable<boolean>): MiddlewareOperator<T> {
  return (source: Observable<T>) => (dispatch: Function, getState: Function) =>
    defer(conditionFn).pipe(
      first(value => value === true), // Wait until the condition observable emits true
      switchMap(() => source)         // Then switch to the source observable
    );
}

export const thunkMiddleware = (): MiddlewareOperator<any> => {
  return (source: any) => (dispatch: Function, getState: Function) => {
    if (typeof source === 'function') {
      if (source.constructor.name !== 'GeneratorFunction' && source.constructor.name !== 'AsyncGeneratorFunction' ) {
        // Handle thunk
        return source(dispatch, getState);
      }
    }
    // If the source is not a function or is a generator function, return it unmodified
    return undefined;
  };
}

export const sagaMiddleware = <T>(): MiddlewareOperator<T> => {
  return (source: () => Generator<Promise<any>, void, any> | AsyncGenerator<Promise<any>, void, any>) => (dispatch: Function, getState: Function) => {
    if (typeof source === 'function' && (source.constructor.name === 'GeneratorFunction' || source.constructor.name === 'AsyncGeneratorFunction')) {
      return new Observable(observer => {
        const iterator = source(); // Start the saga
        const sagaName = source.name.toUpperCase(); // Capitalize the saga name
        observer.next({ type: `${sagaName}_STARTED` }); // Dispatch SAGA_START action with capitalized saga name
        resolveIterator(iterator);

        async function resolveIterator(iterator: AsyncIterator<Promise<any>> | Iterator<Promise<any>>) {
          const { value, done } = await Promise.resolve(iterator.next());

          if (!done) {
            value.then(result => {
              observer.next(result); // Dispatch the result as an action
              iterator.next(result);
              resolveIterator(iterator);
            });
          } else {
            observer.next({ type: `${sagaName}_FINISHED` }); // Dispatch SAGA_FINISHED action with capitalized saga name
            observer.complete(); // Complete the Observable when the saga is done
          }
        }

        // Return teardown logic
        return () => {
          // Handle cleanup if necessary
        };
      });
    } else {
      return undefined;
    }
  }
};


// Logger middleware as an RxJS operator
export const loggerMiddleware = <T>(): MiddlewareOperator<T> => (source: Observable<T>) => (dispatch: Function, getState: Function) =>
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
      function step({value, done}: IteratorResult<Promise<T>, T>) {
        const promise: Promise<T> = Promise.resolve(value);
        if (done) {
          resolve(promise);
        } else {
          promise.then(
            result => step(generator.next(result)),
            error => step(generator.throw(error))
          );
        }
      }
      step(generator.next());
    });
  }

export function adaptMiddleware(middleware: any): (source: Observable<any>) => (dispatch: Function, getState: Function) => Observable<any> {
  return (source: Observable<any>) => (dispatch: Function, getState: Function) => {
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


function rootMetaReducer(reducer: Reducer<any>) {
  return function (state: any, action: Action<any>) {
    if (action.type === 'INIT_TREE' || action.type === 'UPDATE_TREE') {
      state = tree.descriptor();
      return state;
    }
    return reducer(state, action);
  };
}


const routes: Routes = [
  { path: '', component: AppComponent },
  { path: 'customers', loadChildren: () => import('../customers/customers.module').then(m => m.CustomersModule)},
  { path: 'suppliers', loadChildren: () => import('../suppliers/suppliers.module').then(m => m.SuppliersModule)},
];


@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    RouterModule.forRoot(routes),
    StoreModule.forRoot({
      transformers: [thunkMiddleware(), sagaMiddleware()],
      processors: [loggerMiddleware()],
      reducers: {
      },
      effects: []
    }, (module: MainModule) => createStore(rootMetaReducer(combineReducers(module.reducers)), supervisor(module)))
  ],
  providers: [
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
