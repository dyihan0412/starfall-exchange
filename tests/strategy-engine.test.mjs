import assert from 'node:assert/strict';
import { createPortfolio } from '../src/portfolio.mjs';
import { createCompany, createMarket } from '../src/market.mjs';
import { createGameState } from '../src/game-controller.mjs';
import { createRule, evaluateRules } from '../src/strategy-engine.mjs';

const moon = createCompany({ id: 'moon', name: '月露药剂工坊', value: 100, price: 82, volatility: 0.02 });
const state = createGameState({ portfolio: createPortfolio(), market: createMarket([moon]) });
const rule = createRule({ stockId: 'moon', trigger: 'BELOW_VALUE', threshold: 0.12, action: 'BUY', percent: 0.10 });
const actions = evaluateRules(state, [rule]);
assert.equal(actions.length, 1);
assert.equal(actions[0].type, 'TRADE');
assert.deepEqual({ side: actions[0].side, mode: actions[0].quantityMode, value: actions[0].value }, { side: 'BUY', mode: 'PERCENT', value: 0.10 });
assert.equal(state.portfolio.cash, 400, '策略判断不能直接改玩家资金');

const noAction = evaluateRules(state, [{ ...rule, threshold: 0.20 }]);
assert.equal(noAction.length, 0);

const fallingMoon = { ...moon, trend: -.03 };
const fallingState = createGameState({ portfolio: createPortfolio(), market: createMarket([fallingMoon]) });
const compound = createRule({ stockId: 'moon', trigger: 'BELOW_VALUE', threshold: .1, secondTrigger: 'TREND_DOWN', secondThreshold: 0, action: 'BUY', percent: .1 });
assert.equal(evaluateRules(fallingState, [compound]).length, 1, '两个条件都满足时应执行复合委托');
assert.equal(evaluateRules(state, [compound]).length, 0, '任一条件不满足时不应执行复合委托');
console.log('strategy tests: passed');
