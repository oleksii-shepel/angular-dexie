import { InMemoryObjectState, Middleware, applyMiddleware, createStore } from 'dexie-state-syncer';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';

export const tree = new InMemoryObjectState();

export const loggerMiddleware: Middleware = ({}: {dispatch: any; getState: any}) => (next: (action: any) => any) => async(action: any) => {
  console.log('[Middleware] Received action:', action);
  const result = await next(action);
  console.log('[Middleware] Processed action:', result);
  return result;
};

export const thunkMiddleware: Middleware = ({dispatch, getState}: {dispatch: any; getState: any}) => (next: (action: any) => any) => async(action: any) => {
  if (typeof action === 'function') {
    return await action(dispatch, getState);
  }
  return await next(action);
}

function rootReducer(state: any, action: any) {
  return tree.descriptor();
}
@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    // StoreModule.forRoot({}, {
    //   metaReducers: [forms(tree)]
    // }),
  ],
  providers: [
    {
      provide: 'Store',
      useFactory: () => createStore(rootReducer, applyMiddleware(thunkMiddleware, loggerMiddleware))
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
