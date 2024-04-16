import {
  Action,
  Reducer,
  StoreModule
} from '@actioncrew/actionstack';
import { perfmon } from '@actioncrew/actionstack/tools';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { RouterModule, Routes } from '@angular/router';
import { InMemoryObjectState } from 'dexie-state-syncer';
import { AppComponent } from './app.component';

export const tree = new InMemoryObjectState();

function rootMetaReducer(reducer: Reducer) {
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

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    RouterModule.forRoot(routes),
    StoreModule.forRoot(
      {
        middleware: [perfmon],
        reducer: (state: any = {}, action: Action<any>) => state,
      }
    ),
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
