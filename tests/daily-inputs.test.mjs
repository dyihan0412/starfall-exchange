import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDailyInputs,
} from '../src/daily-inputs.mjs';

import {
  createSeededRandom,
} from '../src/random.mjs';

const companies = [
  {
    id: 'stable',
    category: 'STABLE',
    volatility: 0.02,
  },
  {
    id: 'growth',
    category: 'GROWTH',
    volatility: 0.04,
  },
  {
    id: 'speculative',
    category: 'SPECULATIVE',
    volatility: 0.08,
  },
];

const regimes = [
  {
    name: '上涨环境',
    business: 0.004,
    sentiment: 0.006,
    market: 0.006,
  },
  {
    name: '下跌环境',
    business: -0.004,
    sentiment: -0.012,
    market: -0.009,
  },
];

const events = {
  stable: [['稳定事件', 0.01, 0.01]],
  growth: [['成长事件', 0.02, 0.02]],
  speculative: [['投机事件', 0.03, 0.03]],
};

function generate(seed) {
  return createDailyInputs({
    companies,
    regimes,
    events,
    random: createSeededRandom(seed),
  });
}

test('每日市场输入可以由种子复现', () => {
  const first = generate(42);
  const repeated = generate(42);
  const different = generate(43);

  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first, different);

  assert.ok(first.stable);
  assert.ok(first.growth);
  assert.ok(first.speculative);
  assert.ok(first.__regime);
  assert.ok(first.__sectorLead);
});