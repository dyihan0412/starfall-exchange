import assert from 'node:assert/strict';
import { createCompany } from '../src/market.mjs';
import { createRule } from '../src/strategy-engine.mjs';
import { createRuntime, chooseRuntimeGuild, setRules, act, advanceRuntimeDay, runtimeSnapshot, chooseBlessing } from '../src/game-runtime.mjs';

const moon = createCompany({ id: 'moon', name: '月露药剂工坊', value: 100, price: 80, volatility: 0.02 });
let run = createRuntime({ companies: [moon] });
run = chooseRuntimeGuild(run, 'ALCHEMY').runtime;
run = setRules(run, [createRule({ stockId: 'moon', trigger: 'BELOW_VALUE', threshold: 0.10, action: 'BUY', percent: 0.10 })]);
run = act(run, { type: 'BUY_PERCENT', stockId: 'moon', percent: 0.10 });
assert.equal(run.core.portfolio.cash, 360);
run = advanceRuntimeDay(run, { moon: { businessChange: 0, sentiment: 0 } });
assert.ok(run.core.portfolio.cash < 360, '自动委托应该在市场结算后被执行');
assert.equal(run.latestBrief.kind, 'BRIEF');
assert.equal(run.telemetry.events.filter(event => event.type === 'TRADE_EXECUTED').length, 2);
assert.equal(runtimeSnapshot(run).progression.run.guildId, 'ALCHEMY');
let fullRun = createRuntime({ companies: [moon], cash: 500 });
fullRun = chooseRuntimeGuild(fullRun, 'ALCHEMY').runtime;
for (let day = 0; day < 12; day += 1) fullRun = advanceRuntimeDay(fullRun, { moon: { businessChange: 0, sentiment: 0 } });
assert.equal(fullRun.core.phase, 'REPORT');
assert.equal(fullRun.settled, true);
assert.ok(fullRun.settlement.gain >= 1);
assert.equal(fullRun.telemetry.events.at(-1).type, 'RUN_SETTLED');
let blessingRun = createRuntime({ companies: [moon], offerSeed: 0 });
blessingRun = chooseRuntimeGuild(blessingRun, 'ALCHEMY').runtime;
assert.equal(blessingRun.mailbox.length, 1, '选择商会后首日信件应立即到达');
assert.deepEqual(blessingRun.mailbox[0].offerIds, ['ALCHEMY_DIVIDEND', 'ALCHEMY_RESEARCH']);
const alternateOffers = chooseRuntimeGuild(createRuntime({ companies: [moon], offerSeed: 4 }), 'ALCHEMY').runtime.mailbox[0].offerIds;
assert.notDeepEqual(alternateOffers, blessingRun.mailbox[0].offerIds, '不同轮回种子应改变首封信的构筑方向');
assert.equal(alternateOffers.includes('ALCHEMY_BANK_AUDIT'), false, '不应提供只作用于未解锁公司的死词条');
blessingRun = advanceRuntimeDay(blessingRun, { moon: { businessChange: 0, sentiment: 0 } });
assert.equal(blessingRun.mailbox.length, 1, '构筑节点之间不应追加信件，也不应阻塞市场推进');
blessingRun = chooseBlessing(blessingRun, 'ALCHEMY_DIVIDEND', 'DAY_1').runtime;
assert.equal(blessingRun.mailbox[0].claimed, true);
blessingRun = act(blessingRun, { type: 'BUY_PERCENT', stockId: 'moon', percent: 0.1 });
const cashBeforeDividend = blessingRun.core.portfolio.cash;
blessingRun = advanceRuntimeDay(blessingRun, { moon: { businessChange: 0, sentiment: 0 } });
assert.ok(blessingRun.core.portfolio.cash > cashBeforeDividend - 36, '复配股息应在日结算后增加现金');
assert.ok(blessingRun.effectLedger.ALCHEMY_DIVIDEND.cashGained > 0, '构筑面板应有可展示的真实生效记录');

const allCompanies = [
  createCompany({ id: 'moon', name: '月露药剂工坊', value: 100, price: 80, volatility: 0.02 }),
  createCompany({ id: 'sky', name: '浮空船坞', value: 80, price: 80, volatility: 0.04 }),
  createCompany({ id: 'crystal', name: '龙晶矿场', value: 100, price: 60, volatility: 0.08 }),
];
let sailRun = chooseRuntimeGuild(createRuntime({ companies: allCompanies }), 'SAIL').runtime;
const sailOffer = sailRun.mailbox[0].offerIds[0];
sailRun = chooseBlessing(sailRun, sailOffer, 'DAY_1').runtime;
assert.match(sailRun.progression.run.blessings[0], /^SAIL_/, '云帆只能从自己的祝福池领取');
assert.equal(chooseBlessing(sailRun, 'ALCHEMY_DIVIDEND', 'DAY_1').ok, false, '不能领取其他商会词条');

let dailyChoiceRun = chooseRuntimeGuild(createRuntime({ companies: allCompanies }), 'ALCHEMY').runtime;
for (let day = 1; day <= 10; day += 1) {
  const mail = dailyChoiceRun.mailbox.find(item => item.day === day);
  if ([1, 4, 7, 10].includes(day)) {
    assert.ok(mail, `第 ${day} 日应收到构筑信`);
    const available = mail.offerIds.find(id => !dailyChoiceRun.progression.run.blessings.includes(id));
    assert.ok(available, `第 ${day} 日应至少有一个未拥有词条`);
    dailyChoiceRun = chooseBlessing(dailyChoiceRun, available, mail.id).runtime;
  } else assert.equal(mail, undefined, `第 ${day} 日应留给挂机观察，不新增构筑选择`);
  if (day < 10) dailyChoiceRun = advanceRuntimeDay(dailyChoiceRun, { moon: {}, sky: {}, crystal: {} });
}
assert.equal(dailyChoiceRun.progression.run.blessings.length, 4, '一轮应形成四个关键构筑选择');
assert.equal(new Set(dailyChoiceRun.mailbox.flatMap(mail => mail.offerIds)).size, 8, '同一轮四封信应优先提供八个不同候选');

const incomeCompany = createCompany({ id: 'moon', name: '月露药剂工坊', value: 100, price: 100, volatility: 0, incomeRate: .04, incomeLabel: '药剂分红' });
let incomeRun = chooseRuntimeGuild(createRuntime({ companies: [incomeCompany] }), 'ALCHEMY').runtime;
incomeRun = act(incomeRun, { type: 'TRADE', side: 'BUY', quantityMode: 'SHARES', value: 2, stockId: 'moon' });
const cashBeforeIncome = incomeRun.core.portfolio.cash;
incomeRun = advanceRuntimeDay(incomeRun, { moon: { businessChange: 0, sentiment: 0 } });
assert.ok(incomeRun.core.portfolio.cash > cashBeforeIncome, '持仓必须在市场日结束时产生经营回款');
assert.ok(incomeRun.incomeLedger.moon > 0, '累计经营回款必须进入可展示账本');
assert.equal(incomeRun.core.portfolio.transactions.at(-1).source, 'OPERATING_INCOME');

const lockedCompany = createCompany({ id: 'bank', name: '星砂银行', value: 100, price: 100 });
let accessRun = chooseRuntimeGuild(createRuntime({ companies: [moon, lockedCompany] }), 'ALCHEMY').runtime;
accessRun = act(accessRun, { type: 'TRADE', side: 'BUY', quantityMode: 'SHARES', value: 1, stockId: 'bank' });
assert.equal(accessRun.core.lastActionResult.ok, false, '未达到声望门槛时不能交易锁定股票');
accessRun = setRules(accessRun, [
  createRule({ stockId: 'moon', trigger: 'BELOW_VALUE', action: 'BUY' }),
  createRule({ stockId: 'bank', trigger: 'BELOW_VALUE', action: 'BUY' }),
]);
assert.equal(accessRun.rules.length, 1, '初始永久进度只允许一个自动委托槽位');
console.log('runtime integration test: passed');
