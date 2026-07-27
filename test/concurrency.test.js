const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { UserLock } = require('../src/concurrency');

describe('UserLock', () => {
  it('serializa chamadas da mesma chave', async () => {
    const lock = new UserLock();
    const order = [];

    const p1 = lock.runExclusive('u1', async () => {
      order.push('a-start');
      await new Promise((r) => setTimeout(r, 40));
      order.push('a-end');
      return 1;
    });

    const p2 = lock.runExclusive('u1', async () => {
      order.push('b-start');
      order.push('b-end');
      return 2;
    });

    const results = await Promise.all([p1, p2]);
    assert.deepEqual(results, [1, 2]);
    assert.deepEqual(order, ['a-start', 'a-end', 'b-start', 'b-end']);
  });

  it('permite paralelismo entre chaves distintas', async () => {
    const lock = new UserLock();
    let concurrent = 0;
    let maxConcurrent = 0;

    async function work() {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 30));
      concurrent -= 1;
    }

    await Promise.all([
      lock.runExclusive('a', work),
      lock.runExclusive('b', work),
    ]);

    assert.equal(maxConcurrent, 2);
  });
});
