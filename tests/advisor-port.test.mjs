import assert from 'node:assert/strict';
import { createCompany, createMarket } from '../src/market.mjs';
import { LocalMarketAdvisor, RemoteAdvisorAdapter } from '../src/advisor-port.mjs';

const snapshot = { day: 4, market: createMarket([
  createCompany({ id: 'moon', name: '月露药剂工坊', value: 100, price: 80, volatility: 0.02 }),
  createCompany({ id: 'sky', name: '浮空船坞', value: 100, price: 105, volatility: 0.05 }),
]) };
const local = new LocalMarketAdvisor();
const brief = local.brief(snapshot);
assert.equal(brief.kind, 'BRIEF');
assert.match(brief.text, /不是买卖指令/);
assert.equal(local.eventCandidate(snapshot).kind, 'EVENT_CANDIDATE');

const remote = new RemoteAdvisorAdapter({ request: async input => ({ kind: 'BRIEF', title: '测试', text: input.task }) });
assert.equal((await remote.brief(snapshot)).text, 'brief');
console.log('advisor tests: passed');
