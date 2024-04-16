import {
  Action,
  AsyncReducer,
  StoreModule
} from '@actioncrew/actionstack';
import { perfmon } from '@actioncrew/actionstack/tools';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { RouterModule, Routes } from '@angular/router';
import { InMemoryObjectState } from 'dexie-state-syncer';
import { AppComponent } from './app.component';

export const tree = new InMemoryObjectState();

async function rootMetaReducer(reducer: AsyncReducer) {
  return async function (state: any, action: Action<any>) {
    switch (action.type) {
      case 'INIT_TREE':
        tree.initialize(action.payload.tree);
        return tree.descriptor();
      case 'UPDATE_TREE':
        tree.update(action.payload.parent, action.payload.subtree);
        return tree.descriptor();
      default:
        await reducer(state, action);
        return tree.descriptor();
    }
  }
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
        metaReducers: [rootMetaReducer],
        reducer: (state: any = {}, action: Action<any>) => state,
      }
    ),
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
