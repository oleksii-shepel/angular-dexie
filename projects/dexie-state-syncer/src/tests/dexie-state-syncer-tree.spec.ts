import { InMemoryObjectState } from '../lib/dexie-state-syncer-in-memory-db';

describe("convertObjectToArray", () => {
  it("should create array from object", async () => {
    let tree = new InMemoryObjectState();
    await tree.initialize({
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
    });
    console.log(await tree.get('b'))

  });
});
