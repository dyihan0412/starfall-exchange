import assert from 'node:assert/strict';
import { createPortfolio, buyByCash, sellByShares, sharesOf, netWorth, liquidate, positionSummary } from '../src/portfolio.mjs';

const initial = createPortfolio(400);
const purchase = buyByCash(initial, 'moon', 100, 40, 1);
assert.equal(purchase.ok, true);
assert.equal(initial.cash, 400, '旧账本不应被修改');
assert.equal(purchase.portfolio.cash, 360);
assert.equal(sharesOf(purchase.portfolio, 'moon'), 0.4);
assert.equal(netWorth(purchase.portfolio, { moon: 100 }), 400);

const rejected = buyByCash(initial, 'moon', 100, 401, 1);
assert.equal(rejected.ok, false);
assert.equal(rejected.reason, '可用资金不足');

const sale = sellByShares(purchase.portfolio, 'moon', 120, 0.25, 2);
assert.equal(sale.ok, true);
assert.equal(sale.portfolio.cash, 390);
assert.equal(sharesOf(sale.portfolio, 'moon'), 0.15);
assert.equal(netWorth(sale.portfolio, { moon: 120 }), 408);
assert.equal(positionSummary(sale.portfolio, 'moon', 120).averageCost, 100, '卖出后剩余持仓应保留移动平均成本');

const secondBuy = buyByCash(sale.portfolio, 'moon', 150, 30, 3);
assert.equal(Math.round(positionSummary(secondBuy.portfolio, 'moon', 150).averageCost * 100) / 100, 128.57, '再次买入应按剩余成本加权');

const oversell = sellByShares(sale.portfolio, 'moon', 120, 1, 2);
assert.equal(oversell.ok, false);
const cleared = liquidate(sale.portfolio, { moon: 120 }, 3);
assert.equal(cleared.cash, 408);
assert.equal(sharesOf(cleared, 'moon'), 0);
console.log('portfolio tests: passed');
