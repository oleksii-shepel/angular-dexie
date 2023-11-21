import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { initTree, updateTree } from './actions';
import { selectTree } from './selectors';
import { concatMap, from } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'dexie-ngrx-store';
  constructor(public store: Store<any>) {
  }

  ngOnInit() {
    this.store.select(selectTree('')).pipe(concatMap(promise => from(promise))).subscribe((value) => {
      console.log(value);
    });

    this.store.dispatch(initTree({init: true}));

    let timeout = setTimeout(() => {
      this.store.dispatch(updateTree({init: true}));
      clearTimeout(timeout);
    }, 5000);
  }
}
