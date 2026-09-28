import assert from 'node:assert/strict';
import { createCompany } from '../src/market.mjs';
import { blessingPoolFor } from '../src/progression.mjs';
import { createRuntime, chooseRuntimeGuild, act, advanceRuntimeDay } from '../src/game-runtime.mjs';

const makeCompanies = ({ skyTrend = 0, crystalPrice = 65 } = {}) => [
  createCompany({ id: 'moon', name: '月露药剂工坊', value: 100, price: 86, volatility: .02 }),
  { ...createCompany({ id: 'sky', name: '浮空船坞', value: 80, price: 80, volatility: .04 }), trend: skyTrend },
  createCompany({ id: 'crystal', name: '龙晶矿场', value: 100, price: crystalPrice, volatility: .08 }),
];
const inputs = () => ({ moon: { businessChange: 0, sentiment: 0 }, sky: { businessChange: 0, sentiment: 0 }, crystal: { businessChange: 0, sentiment: 0 } });
const withBlessings = (guildId, ids, options) => {
  let runtime = chooseRuntimeGuild(createRuntime({ companies: makeCompanies(options) }), guildId).runtime;
  return { ...runtime, progression: { ...runtime.progression, run: { ...runtime.progression.run, blessings: ids } } };
};

for (const guildId of ['ALCHEMY', 'SAIL', 'CRYSTAL']) {
  const pool = blessingPoolFor(guildId);
  assert.equal(pool.length, 12, `${guildId} 应有十二个专属词条`);
  assert.ok(pool.every(blessing => blessing.guild === guildId));
  assert.ok(pool.every(blessing => blessing.effect?.stage && blessing.effect?.type), '每个词条必须声明真实效果');
}

const alchemyBase = advanceRuntimeDay(withBlessings('ALCHEMY', []), inputs());
let alchemy = withBlessings('ALCHEMY', ['ALCHEMY_RESEARCH', 'ALCHEMY_CALIBRATION', 'ALCHEMY_RESERVE']);
alchemy = advanceRuntimeDay(alchemy, inputs());
assert.ok(alchemy.core.market.companies.moon.value > alchemyBase.core.market.companies.moon.value, '配方迭代应提高合理价值');
assert.ok(alchemy.core.market.companies.moon.price > alchemyBase.core.market.companies.moon.price, '价值校准应增强价格回归');
assert.equal(alchemy.core.portfolio.cash, 402.4, '三词条升阶后，稳健储备应按 2 阶倍率真实写入现金');

let routeBuild = withBlessings('ALCHEMY', ['ALCHEMY_DIVIDEND', 'ALCHEMY_RESERVE']);
routeBuild = act(routeBuild, { type: 'TRADE', side: 'BUY', quantityMode: 'SHARES', value: 1, stockId: 'moon' });
routeBuild = advanceRuntimeDay(routeBuild, inputs());
assert.equal(routeBuild.effectLedger.ALCHEMY_RESERVE.cashGained, 2.53, '两项现金流词条应叠加阶级与路线联动倍率');

const sailBase = advanceRuntimeDay(withBlessings('SAIL', [], { skyTrend: .02 }), inputs());
let sail = withBlessings('SAIL', ['SAIL_TAILWIND', 'SAIL_MOMENTUM', 'SAIL_CONTRACT'], { skyTrend: .02 });
sail = advanceRuntimeDay(sail, inputs());
assert.ok(sail.core.market.companies.sky.value > sailBase.core.market.companies.sky.value, '顺风帆和远航订单应提高经营结果');
assert.ok(sail.core.market.companies.sky.price > sailBase.core.market.companies.sky.price, '航线动量应提高市场价格');

let turnover = withBlessings('SAIL', ['SAIL_TURNOVER']);
turnover = act(turnover, { type: 'TRADE', side: 'BUY', quantityMode: 'SHARES', value: 1, stockId: 'sky' });
turnover = act(turnover, { type: 'TRADE', side: 'SELL', quantityMode: 'SHARES', value: .5, stockId: 'sky' });
assert.equal(turnover.runEffects.quickTurnoverReady, true);
turnover = act(turnover, { type: 'TRADE', side: 'BUY', quantityMode: 'CASH', value: 80, stockId: 'sky' });
assert.equal(turnover.core.portfolio.holdings.sky, 1.55, '快速周转应让同样资金多获得 5% 股份');
assert.equal(turnover.runEffects.quickTurnoverReady, false);

const crystalBase = advanceRuntimeDay(withBlessings('CRYSTAL', [], { crystalPrice: 60 }), inputs());
let crystal = withBlessings('CRYSTAL', ['CRYSTAL_REVERSION', 'CRYSTAL_VEIN', 'CRYSTAL_RUMOR'], { crystalPrice: 60 });
crystal = advanceRuntimeDay(crystal, inputs());
assert.ok(crystal.core.market.companies.crystal.value > crystalBase.core.market.companies.crystal.value, '丰矿脉应提高合理价值');
assert.ok(crystal.core.market.companies.crystal.price > crystalBase.core.market.companies.crystal.price, '罗盘和传闻应影响市场价格');

let refining = withBlessings('CRYSTAL', ['CRYSTAL_REFINING'], { crystalPrice: 60 });
refining = act(refining, { type: 'TRADE', side: 'BUY', quantityMode: 'SHARES', value: 1, stockId: 'crystal' });
const before = refining.core.portfolio.cash;
refining = advanceRuntimeDay(refining, inputs());
assert.ok(refining.core.portfolio.cash > before, '高压提炼应在高波动日产生真实现金收益');
assert.ok(refining.effectLedger.CRYSTAL_REFINING.cashGained > 0);

console.log('blessing effect tests: passed');
