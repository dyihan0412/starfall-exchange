import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeededRandom } from '../src/random.mjs';

function sample(seed, count = 5) {
  const random = createSeededRandom(seed);

  return Array.from(
    { length: count },
    () => random(),
  );
}

test('带种子的随机数可重复', () => {
  const first = sample(42);
  const repeated = sample(42);
  const different = sample(43);

  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first, different);

  assert.ok(
    [...first, ...different]
      .every(value => value >= 0 && value < 1),
  );
});