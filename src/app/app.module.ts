import { Observable } from 'rxjs';
import { InMemoryObjectState, Middleware, applyMiddleware, createStore } from 'dexie-state-syncer';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';

export const tree = new InMemoryObjectState();

// export const loggerMiddleware: Middleware = ({}: {dispatch: any; getState: any}) => (next: (action: any) => any) => async(action: any) => {
//   console.log('[Middleware] Received action:', action);
//   const result = await next(action);
//   console.log('[Middleware] Processed action:', result);
//   return result;
// };

// export const thunkMiddleware: Middleware = ({dispatch, getState}: {dispatch: any; getState: any}) => (next: (action: any) => any) => async(action: any) => {
//   if (typeof action === 'function') {
//     return await action(dispatch, getState);
//   }
//   return await next(action);
// }

// Define a type for the middleware function that works with any type T
export type MiddlewareOperator<T> = (source: Observable<T>) => Observable<T>;

// Logger middleware as an RxJS operator
export const loggerMiddleware = <T>(): MiddlewareOperator<T> => (source: Observable<T>) =>
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
export const thunkMiddleware = <T>(dispatch: any, getState: any): MiddlewareOperator<T> => (source: Observable<T>) =>
  new Observable<T>((observer) => {
    return source.subscribe({
      next: async (action) => {
        if (typeof action === 'function') {
          try {
            const result = await action(dispatch, getState);
            observer.next(result);
          } catch (error) {
            observer.error(error);
          }
        } else {
          observer.next(action);
        }
      },
      error: (err) => observer.error(err),
      complete: () => observer.complete(),
    });
  });

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
      useFactory: () => createStore(rootReducer, tree.descriptor())
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
