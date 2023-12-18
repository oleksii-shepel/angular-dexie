import { NgModule } from '@angular/core';
import { StoreModule } from '@ngrx/store';
import { DexieStateSyncerComponent } from './dexie-state-syncer.component';



@NgModule({
  declarations: [
    DexieStateSyncerComponent
  ],
  imports: [
    StoreModule
  ],
  exports: [
    DexieStateSyncerComponent
  ]
})
export class DexieStateSyncerModule { }
