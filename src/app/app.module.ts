import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { Action, InMemoryObjectState, MainModule, MiddlewareOperator, Reducer, StoreModule, combineReducers, createStore, supervisor } from 'dexie-state-syncer';
import { Observable, defer, first, switchMap } from 'rxjs';

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

// Thunk middleware
// export const thunkMiddleware = (): MiddlewareOperator<any> => {
//   return (source: Observable<Action<any>> | AsyncAction<any>) => (dispatch: Function, getState: Function) => {
//     if (typeof source === 'function') {
//       // If the source is a function, it's an AsyncAction
//       source = source(dispatch, getState);
//     } else if(!(source instanceof Observable)){
//       // If the source is neither an Observable nor a function, throw an error
//       throw new Error('Invalid source type. Source must be an Observable or a function.');
//     }
//     return source;
//   };
// }

export const thunkMiddleware = (): MiddlewareOperator<any> => {
  return (source: any) => (dispatch: Function, getState: Function) => {
    if (typeof source === 'function') {
      // If the source is a function, it's an AsyncAction
      source = source(dispatch, getState);
    } else if(!(source instanceof Observable)){
      // If the source is neither an Observable nor a function, throw an error
      throw new Error('Invalid source type. Source must be an Observable or a function.');
    }
    return source;
  };
}




export const sagaMiddleware = <T>(saga: (action: T) => Generator<Promise<any>, void, any>): MiddlewareOperator<T> => {
  return (source: Observable<T>) => (dispatch: Function, getState: Function) => {
    return new Observable(observer => {
      const subscription = source.subscribe({
        next(action) {
          const iterator = saga(action);
          resolveIterator(iterator);
        },
        error(err) { observer.error(err); },
        complete() { observer.complete(); }
      });

      function resolveIterator(iterator: Iterator<Promise<any>>) {
        const { value, done } = iterator.next();

        if (!done) {
          value.then(result => {
            iterator.next(result);
            resolveIterator(iterator);
          });
        }
      }

      // Return teardown logic
      return () => {
        subscription.unsubscribe();
      };
    });
  };
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
      transformers: [thunkMiddleware()],
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
