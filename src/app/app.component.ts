import { Component, Inject, OnInit } from '@angular/core';
import { Store, initTreeObservable, updateTreeObservable } from 'dexie-state-syncer';
import { selectTree } from './selectors';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'dexie-ngrx-store';
  constructor(@Inject('Store') private store: Store<any>) {
    // Create a Redux store holding the state of your app.
    // Its API is { subscribe, dispatch, getState }.

    // Create the middleware chain

    // let selector = createSelector(
    //   (state: any) => state,
    //   (state: any) => state,
    // );

    //store.pipe(select(selector)).subscribe((value: any) => console.log(value));
    //store.subscribe(async(value: any) => selector(value).then(console.log));


    //chain.execute({type: 'chained/action'});
    // You can use subscribe() to update the UI in response to state changes.
    // Normally you'd use a view binding library (e.g. React Redux) rather than subscribe() directly.
    // There may be additional use cases where it's helpful to subscribe as well.


    // The only way to mutate the internal state is to dispatch an action.
    // The actions can be serialized, logged or stored and later replayed.
    //store.dispatch({ type: 'counter/incremented' })
    // {value: 1}
    //store.dispatch({ type: 'counter/incremented' })
    // {value: 2}
    //store.dispatch({ type: 'counter/decremented' })
    // {value: 1}
    // store.dispatch(async() => {
    //   store.dispatch({type: 'thunk/dispatched'});
    //   let counter = 0;
    //   let interval = setInterval(() => {
    //     let timeout = setInterval(() => {
    //       store.dispatch({type: 'thunk/dispatched2'});
    //       if(counter % 2 === 0) clearInterval(timeout);
    //       counter++;
    //     }, 100);
    //     if(counter <= 5) { clearInterval(interval);}
    //   }, 500);
    // })
  }

  ngOnInit() {

    const stateSelector = selectTree('');
    this.store.subscribe(async (value) => {
      // Use the already instantiated stateSelector function to get the derived state
      let derivedState = await stateSelector(value);
      console.log(derivedState);
    });

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
