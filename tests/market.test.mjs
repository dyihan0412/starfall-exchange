import assert from 'node:assert/strict';
import { createCompany, createMarket, applyMarketDay, advanceMarket, pricesOf, operatingIncomeRate } from '../src/market.mjs';

const moon = createCompany({ id: 'moon', name: '月露药剂工坊', value: 100, price: 80, volatility: 0.02 });
const goodDay = applyMarketDay(moon, { businessChange: 0.10, sentiment: 0 });
assert.equal(goodDay.value, 110, '经营变好应提高合理价值');
assert.ok(goodDay.price > 80, '低于价值的价格应向上靠拢');
assert.equal(goodDay.history.length, 2, '每天必须留下一个价格点');

const panicDay = applyMarketDay(moon, { businessChange: 0, sentiment: -0.10 });
assert.ok(panicDay.price < 80, '恐慌情绪应压低市场价格');
assert.equal(moon.price, 80, '旧市场状态不应被修改');

const market = createMarket([moon]);
const nextMarket = advanceMarket(market, { moon: { businessChange: 0.05, sentiment: 0.02 } });
assert.equal(nextMarket.day, 2);
assert.equal(pricesOf(nextMarket).moon, nextMarket.companies.moon.price);

const trendStock = { ...createCompany({ id: 'trend', name: '趋势股', value: 100, price: 100, volatility: .05, momentum: .8 }), trend: .05 };
const defensiveStock = { ...createCompany({ id: 'defensive', name: '防御股', value: 100, price: 100, volatility: .02, momentum: .02 }), trend: .05 };
const trendNext = applyMarketDay(trendStock, { sentiment: 0 });
const defensiveNext = applyMarketDay(defensiveStock, { sentiment: 0 });
assert.ok(trendNext.price > defensiveNext.price, '不同代理人敏感度应形成不同走势');
const eventDay = applyMarketDay(moon, { eventChange: -.02, eventPriceChange: -.03, eventLabel: '配方污染' });
assert.equal(eventDay.lastMove.eventLabel, '配方污染');
assert.match(eventDay.lastMove.summary, /事件/);

const macroStock = createCompany({ id: 'macro', name: '大盘股', value: 100, price: 100, volatility: .04, meanReversion: 0, momentum: 0, sentimentSensitivity: 1, beta: 1.5, priceLimit: .1 });
const macroDay = applyMarketDay(macroStock, { marketChange: .02, sectorChange: .01, liquidityShock: -.005 });
assert.equal(macroDay.lastMove.drivers.macro, 3, '大盘涨跌应按公司贝塔进入价格归因');
assert.equal(macroDay.lastMove.drivers.sector, 1, '板块轮动应独立进入价格归因');
assert.equal(macroDay.lastMove.drivers.liquidity, -.5, '流动性冲击应可解释');
const limitDay = applyMarketDay({ ...macroStock, priceLimit: .05 }, { eventPriceChange: .5 });
assert.equal(limitDay.trend, .05, '极端事件不能突破公司涨跌幅限制');
assert.equal(limitDay.lastMove.limitHit, true);

const rotated = advanceMarket(market, { moon: {}, __regime: '资金退潮', __sectorLead: '稳健板块走强' });
assert.equal(rotated.regime, '资金退潮');
assert.equal(rotated.sectorLead, '稳健板块走强');

assert.equal(operatingIncomeRate(createCompany({ id: 'steady', name: '稳定股', value: 100, price: 100, incomeRate: .03 }), 2), .03);
assert.equal(operatingIncomeRate({ ...trendStock, incomeRate: .06, incomeRule: 'TREND_UP' }, 2), .06);
assert.equal(operatingIncomeRate({ ...trendStock, trend: -.01, incomeRate: .06, incomeRule: 'TREND_UP' }, 2), .012);
assert.equal(operatingIncomeRate({ ...trendStock, incomeRate: .1, incomeRule: 'CYCLE_3' }, 3), .1);
console.log('market tests: passed');
