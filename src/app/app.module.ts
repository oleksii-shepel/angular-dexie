import { Observable, Subscription, concatMap, defer, first, from, of, switchMap } from 'rxjs';
import { Action, AsyncAction, InMemoryObjectState, MiddlewareOperator, applyMiddleware, createStore } from 'dexie-state-syncer';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { Semaphore } from 'projects/dexie-state-syncer/src/lib/dexie-state-syncer-semaphore';

export const tree = new InMemoryObjectState();

// Custom operator that waits for a condition observable to emit true.
export function waitUntil<T>(conditionFn: () => Observable<boolean>): MiddlewareOperator<T> {
  return (source: Observable<T>) => (dispatch: Function, getState: Function) =>
    defer(conditionFn).pipe(
      first(value => value === true), // Wait until the condition observable emits true
      switchMap(() => source)         // Then switch to the source observable
    );
}

// Instantiate the Semaphore with the desired maximum concurrency
const semaphore = new Semaphore(1);

export const thunkMiddleware = (): MiddlewareOperator<any> => {
  return (source: Observable<Action<any>> | AsyncAction<any>) => (dispatch: Function, getState: Function) => {
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

// Thunk middleware as an RxJS operator
// export const thunkMiddleware = <T>(): MiddlewareOperator<T> => (source: Observable<T>) => (dispatch: Function, getState: Function) =>
//   new Observable<T>((observer) => {
//     return source.subscribe({
//       next: async (action: T | Function) => {
//         if (typeof action === 'function') {
//           try {
//             // Assuming the thunk action returns a Promise of type T
//             const result: T = await (action as Function)(dispatch, getState);
//             observer.next(result);
//           } catch (error) {
//             observer.error(error);
//           }
//         } else {
//           observer.next(action as T);
//         }
//       },
//       error: (err: any) => observer.error(err),
//       complete: () => observer.complete(),
//     });
//   });

// Custom operator that waits for a notifier observable to emit true.
// export function waitUntil<T>(notifier: Observable<boolean>): MiddlewareOperator<T> {
//   return (source: Observable<T>) =>
//     new Observable<T>((subscriber) => {
//       const subscription = notifier.pipe(filter(value => value), take(1)).subscribe({
//         next: () => {
//           source.subscribe({
//             next: (value) => subscriber.next(value),
//             error: (err) => subscriber.error(err),
//             complete: () => subscriber.complete(),
//           });
//         },
//         error: (err) => subscriber.error(err),
//       });

//       return () => {
//         subscription.unsubscribe();
//       };
//     });
// }
//       return () => {
//         subscription.unsubscribe();
//       };
//     });
// }


function rootReducer(state: any, action: any) {
  return tree.descriptor();
}
@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule
  ],
  providers: [
    {
      provide: 'Store',
      useFactory: () => {
        const operatorFunctions = [
          thunkMiddleware(),
          loggerMiddleware(),
          // ... any additional operator functions ...
        ];
        return createStore(rootReducer, tree.descriptor(), applyMiddleware(...operatorFunctions))
      }

    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
