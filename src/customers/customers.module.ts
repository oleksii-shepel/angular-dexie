import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { Component, Inject, OnInit } from '@angular/core';
import { Reducer, Store, StoreModule } from 'dexie-state-syncer';

// Define some basic customers data
const customersData = [
  { id: 1, name: 'Customer A', location: 'Location A' },
  { id: 2, name: 'Customer B', location: 'Location B' },
  { id: 3, name: 'Customer C', location: 'Location C' }
];

// Define a simple reducer
const customersReducer: Reducer<any> = (state = customersData, action) => {
  switch (action.type) {
    case 'CUSTOMERS_ACTION':
      return { ...state, customersData: action.payload };
    default:
      return state;
  }
};

@Component({
  selector: 'customer',
  template: `
    <div>Customer Module</div>
  `,
  styles: [``]
})
export class CustomerComponent implements OnInit {
  title = 'dexie-ngrx-store';
  constructor(@Inject('Store') private store: Store<any>) {}

  ngOnInit() {}
}

@NgModule({
  declarations: [
    CustomerComponent
  ],
  imports: [
    CommonModule,
    StoreModule.forFeature({
      slice: 'customers',
      state: customersData,
      reducer: customersReducer,
      effects: []
    })
  ]
})
export class CustomersModule { }
