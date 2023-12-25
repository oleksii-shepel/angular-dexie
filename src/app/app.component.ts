import { Component, Inject, OnInit } from '@angular/core';
import { Store, initTreeObservable, updateTreeObservable, updateTreeObservable1, updateTreeObservable2 } from 'dexie-state-syncer';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'dexie-ngrx-store';
  constructor(@Inject('Store') private store: Store) {

  }

  ngOnInit() {

    // const stateSelector = selectTree('');
    // this.store.subscribe(async (value) => {
    //   // Use the already instantiated stateSelector function to get the derived state
    //   let derivedState = await stateSelector(value);
    //   console.log(derivedState);
    // });



    this.store.dispatch(initTreeObservable({
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

    this.store.dispatch(updateTreeObservable('b', {
      c: 'asd',
      d: 'sadf',
      e : {
        f: 'dfasdasdasd',
        g: 'gevrevre'
      }
    }));

    this.store.dispatch(updateTreeObservable1('b', {
      c: 'asd',
      d: 'sadf',
      e : {
        f: 'dfasdasdasd',
        g: 'gevrevre'
      }
    }));

    this.store.dispatch(updateTreeObservable2('b', {
      c: 'asd',
      d: 'sadf',
      e : {
        f: 'dfasdasdasd',
        g: 'gevrevre'
      }
    }));

    let timeout = setTimeout(() => {
      this.store.dispatch(updateTreeObservable('b', {
        c: 'asd',
        d: 'sadf',
        e : {
          f: 'dfasdasdasd',
          g: 'gevrevre'
        }
      }));
      clearTimeout(timeout);
    }, 5000);
  }
}
