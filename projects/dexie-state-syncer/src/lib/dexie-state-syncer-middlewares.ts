import { Action } from "./dexie-state-syncer-actions";
import { Lock } from "./dexie-state-syncer-lock";
import { Middleware } from "./dexie-state-syncer-redux";

export function sequential(middleware: Middleware): Middleware {
  const lock = new Lock();

  return ({ dispatch, getState }) => (next) => async (action: Action<any>) => {
    await lock.acquire();

    try {
      await middleware({ dispatch, getState })(next)(action);
    } finally {
      lock.release();
    }
  };
}
