import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import {
  Action,
  InMemoryObjectState,
  MainModule,
  Reducer,
  StoreModule,
  combineReducers,
  createStore,
  loggerMiddleware,
  sagaMiddleware,
  supervisor,
  thunkMiddleware
} from 'dexie-state-syncer';

import { RouterModule, Routes } from '@angular/router';
import { AppComponent } from './app.component';

export const tree = new InMemoryObjectState();

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
  {
    path: 'customers',
    loadChildren: () =>
      import('../customers/customers.module').then((m) => m.CustomersModule),
  },
  {
    path: 'suppliers',
    loadChildren: () =>
      import('../suppliers/suppliers.module').then((m) => m.SuppliersModule),
  },
];

function* rootSaga(): Generator<Promise<any>, any, any> {
  console.log('Hello from saga');
};
@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    RouterModule.forRoot(routes),
    StoreModule.forRoot(
      {
        transformers: [thunkMiddleware, sagaMiddleware],
        processors: [loggerMiddleware],
        reducers: {},
        effects: [rootSaga],
      },
      (module: MainModule) =>
        createStore(
          rootMetaReducer(combineReducers(module.reducers)),
          supervisor(module)
        )
    ),
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
