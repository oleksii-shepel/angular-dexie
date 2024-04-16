import { Store } from '@actioncrew/actionstack';
import { Component, OnInit } from '@angular/core';
import { initTree, updateTree } from './actions';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'dexie-ngrx-store';
  constructor(private store: Store) {
  }

  ngOnInit() {
    this.store.dispatch(initTree({
      a: 'sdsd',
      b: {
        c: 'asd',
        d: 'sadf',
        e : {
          f: 'dfasdasdasd',
          g: 'gevrevre'
        }
      },
      i: {
        j: 'dsfsdf'
      },
      k: 'sadas'
    }));

    this.store.dispatch(updateTree('b', {
      c: 'asd',
      d: 'sadf',
      e : {
        f: 'dfasdasdasd',
        g: 'gevrevre'
      }
    }));
  }
}
