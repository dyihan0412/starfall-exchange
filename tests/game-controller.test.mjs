import assert from 'node:assert/strict';
import { createPortfolio, sharesOf } from '../src/portfolio.mjs';
import { createCompany, createMarket } from '../src/market.mjs';
import { createGameState, dispatch, advanceDay } from '../src/game-controller.mjs';

const market = createMarket([createCompany({ id: 'moon', name: '月露药剂工坊', value: 100, price: 100, volatility: 0.02 })]);
let state = createGameState({ portfolio: createPortfolio(400), market });
state = dispatch(state, { type: 'TRADE', side: 'BUY', quantityMode: 'PERCENT', value: 0.10, stockId: 'moon' });
assert.equal(state.portfolio.cash, 360);
assert.equal(sharesOf(state.portfolio, 'moon'), 0.4);
state = dispatch(state, { type: 'TRADE', side: 'BUY', quantityMode: 'CASH', value: 100, stockId: 'moon' });
assert.equal(sharesOf(state.portfolio, 'moon'), 1.4);
state = dispatch(state, { type: 'TRADE', side: 'SELL', quantityMode: 'SHARES', value: 0.4, stockId: 'moon' });
assert.equal(sharesOf(state.portfolio, 'moon'), 1);
state = advanceDay(state, { moon: { businessChange: 0.05, sentiment: 0 } });
assert.equal(state.day, 2);
assert.equal(state.market.companies.moon.value, 105);
assert.match(state.log.at(-1).message, /市场日结算/);
console.log('controller tests: passed');
