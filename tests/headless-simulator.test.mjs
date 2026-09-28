import test from 'node:test';
import assert from 'node:assert/strict';
import { minimalStrategies, simulateMinimalExperiment, simulateRun } from '../src/headless-simulator.mjs';

test('单轮无界面模拟使用正式结算并记录 day=0..12', () => {
  const result = simulateRun({ marketSeed: 0, strategyId: 'moon_hold', stockId: 'moon' });
  assert.equal(result.run.market_seed, 0);
  assert.equal(result.run.final_worth, result.days.at(-1).net_worth);
  assert.equal(result.days.length, 13);
  assert.deepEqual(result.days.map(row => row.day), Array.from({ length: 13 }, (_, day) => day));
  assert.equal(result.stockDays.length, 13 * 6);
  assert.equal(result.days[0].net_worth, 400);
  assert.equal(result.days[0].cash, 0);
  assert.equal(result.stockDays.find(row => row.day === 12 && row.stock_id === 'moon').shares, 0, '正式第 12 日结算后应已自动清仓');
});

test('共同随机数让同一种子的四种策略经历相同价格路径', () => {
  const data = simulateMinimalExperiment({ seeds: [3] });
  assert.equal(data.runs.length, minimalStrategies.length);
  for (const stockId of ['moon', 'sky', 'crystal']) {
    const paths = minimalStrategies.map(strategy => data.stockDays
      .filter(row => row.run_id.endsWith(strategy.id) && row.stock_id === stockId)
      .map(row => row.price));
    paths.slice(1).forEach(path => assert.deepEqual(path, paths[0]));
  }
  assert.equal(data.days.length, 4 * 13);
  assert.equal(data.stockDays.length, 4 * 13 * 6);
});
