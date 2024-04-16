import { Action, Reducer, Store, StoreModule } from '@actioncrew/actionstack';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { Component, OnInit } from '@angular/core';

// Define some basic suppliers data
const suppliersData = [
  { id: 1, name: 'Supplier X', location: 'Location X' },
  { id: 2, name: 'Supplier Y', location: 'Location Y' },
  { id: 3, name: 'Supplier Z', location: 'Location Z' }
];

const suppliersReducer: Reducer = (state = suppliersData, action: Action<any>) => {
  switch (action.type) {
    case 'SUPPLIERS_ACTION':
      return { ...state, suppliersData: action.payload };
    default:
      return state;
  }
};

@Component({
  selector: 'supplier',
  template: `
    <div>Supplier Module</div>
  `,
  styles: [``]
})
export class SupplierComponent implements OnInit {
  title = 'dexie-ngrx-store';
  constructor(private store: Store) {}

  ngOnInit() {}
}


@NgModule({
  declarations: [
    SupplierComponent
  ],
  imports: [
    CommonModule,
    StoreModule.forFeature({
      slice: 'suppliers',
      reducer: suppliersReducer,
    })
  ],
})
export class SuppliersModule { }
