import { Action, Reducer, Store, StoreModule } from '@actioncrew/actionstack';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { Component, OnInit } from '@angular/core';

// Define some basic customers data
const customersData = [
  { id: 1, name: 'Customer A', location: 'Location A' },
  { id: 2, name: 'Customer B', location: 'Location B' },
  { id: 3, name: 'Customer C', location: 'Location C' }
];

// Define a simple reducer
const customersReducer: Reducer = (state = customersData, action: Action<any>) => {
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
  constructor(private store: Store) {}

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
      reducer: customersReducer,
    })
  ]
})
export class CustomersModule { }
