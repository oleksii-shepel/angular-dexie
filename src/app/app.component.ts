import { Component, OnInit } from '@angular/core';
import { Middleware, applyMiddleware, createStore } from 'dexie-state-syncer'
import { Semaphore } from 'projects/dexie-state-syncer/src/lib/dexie-state-syncer-semaphore';

function counterReducer(state = { value: 0 }, action: any) {
  switch (action.type) {
    case 'counter/incremented':
      return { value: state.value + 1 }
    case 'counter/decremented':
      return { value: state.value - 1 }
    default:
      return state
  }
}

export class LoggerMiddleware extends Middleware {
  semaphore = new Semaphore(1);
  override async handle(action: any, next: (action: any) => void) {
    return this.semaphore.callFunction(async () => {
      console.log('Dispatching:', action);
      const result = await next(action);
      console.log('Next state:', this.getState());
      return result;
    });
  }
};

export class ThunkMiddleware extends Middleware {
  override async handle(action: any, next: (action: any) => void) {
    if (typeof action === 'function') {
      return await action(this.dispatch, this.getState);
    }
    return await next(action);
  }
};

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'dexie-ngrx-store';
  constructor() {
    // Create a Redux store holding the state of your app.
    // Its API is { subscribe, dispatch, getState }.

// Create the middleware chain


    let store = createStore(counterReducer,{ value: 0 }, applyMiddleware(
      new ThunkMiddleware((action, ...extraArgs) => store.dispatch(action, extraArgs), () => store.getState()),
      new LoggerMiddleware((action, ...extraArgs) => store.dispatch(action, extraArgs), () => store.getState()),
    ));


    //chain.execute({type: 'chained/action'});
    // You can use subscribe() to update the UI in response to state changes.
    // Normally you'd use a view binding library (e.g. React Redux) rather than subscribe() directly.
    // There may be additional use cases where it's helpful to subscribe as well.

    store.subscribe(() => console.log(store.getState()))

    // The only way to mutate the internal state is to dispatch an action.
    // The actions can be serialized, logged or stored and later replayed.
    store.dispatch({ type: 'counter/incremented' })
    // {value: 1}
    store.dispatch({ type: 'counter/incremented' })
    // {value: 2}
    store.dispatch({ type: 'counter/decremented' })
    // {value: 1}
    store.dispatch(async() => {
      store.dispatch({type: 'thunk/dispatched'});
      let counter = 0;
      let interval = setInterval(() => {
        let timeout = setInterval(() => {
          store.dispatch({type: 'thunk/dispatched2'});
          if(counter % 2 === 0) clearInterval(timeout);
          counter++;
        }, 100);
        if(counter === 5) { clearInterval(interval);}
      }, 500);
    })
  }

  ngOnInit() {
    // this.store.select(selectTree('')).pipe(concatMap(promise => from(promise))).subscribe((value) => {
    //   console.log(value);
    // });

    // this.store.dispatch(initTree({init: true}));

    // let timeout = setTimeout(() => {
    //   this.store.dispatch(updateTree({init: true}));
    //   clearTimeout(timeout);
    // }, 5000);
  }
}
