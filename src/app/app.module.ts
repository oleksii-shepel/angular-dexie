import { InMemoryObjectState, forms } from 'dexie-state-syncer';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { StoreModule } from '@ngrx/store';

const tree = new InMemoryObjectState();

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    StoreModule.forRoot({}, {
      metaReducers: [forms(tree.descriptor())]
    }),
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
