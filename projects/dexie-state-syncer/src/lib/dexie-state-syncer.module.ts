import { NgModule } from '@angular/core';
import { DexieStateSyncerComponent } from './dexie-state-syncer.component';
import { StoreModule } from '@ngrx/store';



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
