/** 成长系统：词条只声明效果，Runtime 负责统一解释和结算。 */
export const guilds = {
  ALCHEMY: { id: 'ALCHEMY', name: '炼金商会', specialty: '稳健现金流 · 价值回归', stocks: ['moon', 'bank'] },
  SAIL: { id: 'SAIL', name: '云帆商会', specialty: '趋势扩张 · 快速周转', stocks: ['sky', 'forge'] },
  CRYSTAL: { id: 'CRYSTAL', name: '晶簇商会', specialty: '波动捕捉 · 逆势交易', stocks: ['crystal', 'dream'] },
};

const b = (id, guild, name, description, effect) => ({ id, guild, name, description, effect });

export const blessings = Object.fromEntries([
  // 炼金：月露 + 星砂银行，稳定收益与估值回归。
  b('ALCHEMY_DIVIDEND', 'ALCHEMY', '复配股息', '月露持仓每日返还市值的 1%。', { stage: 'POST', type: 'HOLDING_YIELD', targets: ['moon'], amount: .01 }),
  b('ALCHEMY_RESEARCH', 'ALCHEMY', '配方迭代', '月露合理价值每日额外增长 1%。', { stage: 'PRE', type: 'BUSINESS', targets: ['moon'], amount: .01 }),
  b('ALCHEMY_RESERVE', 'ALCHEMY', '稳健储备', '每日结算直接获得 2 星铢。', { stage: 'POST', type: 'CASH_FLAT', amount: 2 }),
  b('ALCHEMY_CALIBRATION', 'ALCHEMY', '价值校准', '月露价格回归合理价值的速度提高 60%。', { stage: 'PRE', type: 'PULL', targets: ['moon'], amount: .6 }),
  b('ALCHEMY_BANK_INTEREST', 'ALCHEMY', '银库利息', '每日获得当前现金的 0.35%。', { stage: 'POST', type: 'CASH_RATE', amount: .0035 }),
  b('ALCHEMY_BANK_AUDIT', 'ALCHEMY', '银库审计', '星砂银行价格回归合理价值的速度提高 50%。', { stage: 'PRE', type: 'PULL', targets: ['bank'], amount: .5 }),
  b('ALCHEMY_JOINT_DIVIDEND', 'ALCHEMY', '联合分红', '月露与星砂银行持仓每日返还市值的 0.45%。', { stage: 'POST', type: 'HOLDING_YIELD', targets: ['moon', 'bank'], amount: .0045 }),
  b('ALCHEMY_BARGAIN', 'ALCHEMY', '折价采购', '买入低于合理价值的股票时，多获得 4% 股份。', { stage: 'TRADE', type: 'BUY_BONUS', condition: 'UNDERVALUED', amount: .04 }),
  b('ALCHEMY_HEDGE', 'ALCHEMY', '防御配方', '月露与星砂银行受到的负面经营事件减轻 40%。', { stage: 'PRE', type: 'EVENT_SHIELD', targets: ['moon', 'bank'], amount: .4 }),
  b('ALCHEMY_FLOOR', 'ALCHEMY', '保底订单', '若本日总资产下跌，结算时获得 4 星铢。', { stage: 'POST', type: 'LOSS_CASH', amount: 4 }),
  b('ALCHEMY_TWIN_VALUE', 'ALCHEMY', '双塔估值', '月露与星砂银行的价值回归速度提高 25%。', { stage: 'PRE', type: 'PULL', targets: ['moon', 'bank'], amount: .25 }),
  b('ALCHEMY_LONG_HOLD', 'ALCHEMY', '长线认证', '所有持仓每日返还市值的 0.2%。', { stage: 'POST', type: 'HOLDING_YIELD', targets: '*', amount: .002 }),

  // 云帆：浮空船坞 + 魔像铸造厂，趋势与周转。
  b('SAIL_TAILWIND', 'SAIL', '顺风帆', '船坞上涨时，合理价值额外增长 1.5%。', { stage: 'PRE', type: 'BUSINESS', targets: ['sky'], condition: 'TREND_UP', amount: .015 }),
  b('SAIL_MOMENTUM', 'SAIL', '航线动量', '船坞上涨时，市场情绪额外增加 2%。', { stage: 'PRE', type: 'SENTIMENT', targets: ['sky'], condition: 'TREND_UP', amount: .02 }),
  b('SAIL_CONTRACT', 'SAIL', '远航订单', '船坞合理价值每日额外增长 0.6%。', { stage: 'PRE', type: 'BUSINESS', targets: ['sky'], amount: .006 }),
  b('SAIL_TURNOVER', 'SAIL', '快速周转', '每次卖出后，下一次买入多获得 5% 股份。', { stage: 'TRADE', type: 'TURNOVER', amount: .05 }),
  b('SAIL_FORGE_ORDER', 'SAIL', '铸造订单', '魔像铸造厂合理价值每日额外增长 0.8%。', { stage: 'PRE', type: 'BUSINESS', targets: ['forge'], amount: .008 }),
  b('SAIL_TWIN_ENGINE', 'SAIL', '双引擎', '船坞与铸造厂合理价值每日额外增长 0.35%。', { stage: 'PRE', type: 'BUSINESS', targets: ['sky', 'forge'], amount: .0035 }),
  b('SAIL_TREND_YIELD', 'SAIL', '趋势红利', '上涨股票的持仓每日返还市值的 0.65%。', { stage: 'POST', type: 'HOLDING_YIELD', targets: '*', condition: 'TREND_UP', amount: .0065 }),
  b('SAIL_CHASE', 'SAIL', '追风加仓', '买入上涨股票时，多获得 4% 股份。', { stage: 'TRADE', type: 'BUY_BONUS', condition: 'TREND_UP', amount: .04 }),
  b('SAIL_SPRINT', 'SAIL', '订单冲刺', '船坞或铸造厂上涨时，每日获得 3 星铢。', { stage: 'POST', type: 'TARGET_TREND_CASH', targets: ['sky', 'forge'], condition: 'TREND_UP', amount: 3 }),
  b('SAIL_FLEET_LINK', 'SAIL', '舰队联动', '船坞或铸造厂上涨时，两者情绪各提高 0.7%。', { stage: 'PRE', type: 'GROUP_SENTIMENT', targets: ['sky', 'forge'], condition: 'ANY_TREND_UP', amount: .007 }),
  b('SAIL_REBATE', 'SAIL', '周转返利', '每次卖出额外返还成交额的 1%。', { stage: 'TRADE', type: 'SALE_REBATE', amount: .01 }),
  b('SAIL_AUTOPILOT', 'SAIL', '自动领航', '自动委托的交易比例提高 25%。', { stage: 'TRADE', type: 'AUTO_SCALE', amount: .25 }),

  // 晶簇：龙晶 + 梦境剧院，波动与逆势。
  b('CRYSTAL_REVERSION', 'CRYSTAL', '裂隙罗盘', '龙晶严重低估时，价值回归速度提高 80%。', { stage: 'PRE', type: 'PULL', targets: ['crystal'], condition: 'SEVERE_UNDERVALUED', amount: .8 }),
  b('CRYSTAL_VEIN', 'CRYSTAL', '丰矿脉', '龙晶合理价值每日额外增长 1%。', { stage: 'PRE', type: 'BUSINESS', targets: ['crystal'], amount: .01 }),
  b('CRYSTAL_RUMOR', 'CRYSTAL', '矿脉传闻', '龙晶市场情绪每日增加 0.8%。', { stage: 'PRE', type: 'SENTIMENT', targets: ['crystal'], amount: .008 }),
  b('CRYSTAL_REFINING', 'CRYSTAL', '高压提炼', '单日波动达到 3% 的持仓返还市值的 1.5%。', { stage: 'POST', type: 'HOLDING_YIELD', targets: ['crystal'], condition: 'HIGH_VOLATILITY', amount: .015 }),
  b('CRYSTAL_DREAM_TIDE', 'CRYSTAL', '梦潮扩散', '梦境剧院市场情绪每日增加 1%。', { stage: 'PRE', type: 'SENTIMENT', targets: ['dream'], amount: .01 }),
  b('CRYSTAL_DUAL_VEIN', 'CRYSTAL', '双生矿脉', '龙晶与梦境剧院合理价值每日额外增长 0.45%。', { stage: 'PRE', type: 'BUSINESS', targets: ['crystal', 'dream'], amount: .0045 }),
  b('CRYSTAL_DIP_BUY', 'CRYSTAL', '低估萃取', '买入低估超过 10% 的股票时，多获得 6% 股份。', { stage: 'TRADE', type: 'BUY_BONUS', condition: 'SEVERE_UNDERVALUED', amount: .06 }),
  b('CRYSTAL_PANIC_BUY', 'CRYSTAL', '恐慌收购', '买入下跌股票时，多获得 5% 股份。', { stage: 'TRADE', type: 'BUY_BONUS', condition: 'TREND_DOWN', amount: .05 }),
  b('CRYSTAL_RESONANCE', 'CRYSTAL', '波动共振', '单日波动达到 3% 的持仓返还市值的 0.7%。', { stage: 'POST', type: 'HOLDING_YIELD', targets: '*', condition: 'HIGH_VOLATILITY', amount: .007 }),
  b('CRYSTAL_COUNTERFLOW', 'CRYSTAL', '逆势回款', '龙晶或梦境剧院下跌时，每日获得 3 星铢。', { stage: 'POST', type: 'TARGET_TREND_CASH', targets: ['crystal', 'dream'], condition: 'TREND_DOWN', amount: 3 }),
  b('CRYSTAL_EVENT_ARMOR', 'CRYSTAL', '事件护甲', '龙晶与梦境剧院受到的负面经营事件减轻 45%。', { stage: 'PRE', type: 'EVENT_SHIELD', targets: ['crystal', 'dream'], amount: .45 }),
  b('CRYSTAL_SPECULATION', 'CRYSTAL', '投机分成', '梦境剧院单日波动达到 4% 时，持仓返还市值的 2%。', { stage: 'POST', type: 'HOLDING_YIELD', targets: ['dream'], condition: 'EXTREME_VOLATILITY', amount: .02 }),
].map(item => [item.id, item]));

export const blessingPoolFor = guildId => Object.values(blessings).filter(blessing => blessing.guild === guildId);

export const routeMeta = {
  INCOME: { name: '现金流', description: '分红、固定回款与持仓收益' },
  FUNDAMENTAL: { name: '基本面', description: '经营增长、估值回归与市场情绪' },
  EXECUTION: { name: '交易执行', description: '买入效率、周转、返利与自动化' },
  DEFENSE: { name: '风险防御', description: '事件减伤与回撤补偿' },
};

/** 由通用效果类型推导构筑路线，避免词条文案与实际效果标签不一致。 */
export function blessingRoute(blessing) {
  const type = blessing?.effect?.type;
  if (['HOLDING_YIELD', 'CASH_FLAT', 'CASH_RATE', 'TARGET_TREND_CASH'].includes(type)) return 'INCOME';
  if (['BUSINESS', 'SENTIMENT', 'PULL', 'GROUP_SENTIMENT'].includes(type)) return 'FUNDAMENTAL';
  if (['BUY_BONUS', 'TURNOVER', 'SALE_REBATE', 'AUTO_SCALE'].includes(type)) return 'EXECUTION';
  return 'DEFENSE';
}

export function buildRouteSummary(blessingIds = []) {
  const counts = Object.fromEntries(Object.keys(routeMeta).map(id => [id, 0]));
  for (const id of blessingIds) {
    const blessing = blessings[id];
    if (blessing) counts[blessingRoute(blessing)] += 1;
  }
  return Object.entries(routeMeta).map(([id, meta]) => {
    const count = counts[id];
    const multiplier = count >= 4 ? 1.3 : count >= 2 ? 1.15 : 1;
    return { id, ...meta, count, multiplier, active: count >= 2 };
  });
}

export function routeMultiplierFor(blessing, blessingIds = []) {
  return buildRouteSummary(blessingIds).find(route => route.id === blessingRoute(blessing))?.multiplier ?? 1;
}

export const accessMilestones = [
  { renown: 0, title: '个人商贩', stockId: 'moon', unlock: '月露药剂工坊、浮空船坞、龙晶矿场；1 个自动委托槽位' },
  { renown: 2, title: '商会交易员', stockId: 'bank', unlock: '星砂银行；2 个自动委托槽位' },
  { renown: 5, title: '策略主管', stockId: 'forge', unlock: '魔像铸造厂；组合条件' },
  { renown: 8, title: '资本经营者', stockId: 'dream', unlock: '梦境剧院；3 个自动委托槽位' },
  { renown: 14, title: '交易所管理者', stockId: null, unlock: '4 个自动委托槽位；经营回款 +10%' },
];

export function metaProgressFor(renown = 0) {
  const unlockedStocks = ['moon', 'sky', 'crystal'];
  if (renown >= 2) unlockedStocks.push('bank');
  if (renown >= 5) unlockedStocks.push('forge');
  if (renown >= 8) unlockedStocks.push('dream');
  const ruleSlots = renown >= 14 ? 4 : renown >= 8 ? 3 : renown >= 2 ? 2 : 1;
  const current = [...accessMilestones].reverse().find(item => renown >= item.renown) ?? accessMilestones[0];
  const next = accessMilestones.find(item => item.renown > renown) ?? null;
  return {
    title: current.title,
    unlockedStocks,
    ruleSlots,
    compoundConditions: renown >= 5,
    incomeMultiplier: renown >= 14 ? 1.1 : 1,
    next,
  };
}

export function createProgression({ renown = 0, unlockedKnowledge = ['VALUE_CRYSTAL'] } = {}) {
  return { renown, unlockedKnowledge, run: { guildId: null, blessings: [] } };
}

export function chooseGuild(progression, guildId) {
  if (!guilds[guildId]) return { progression, ok: false, reason: '未找到这个商会。' };
  return { progression: { ...progression, run: { guildId, blessings: [] } }, ok: true, reason: `已加入${guilds[guildId].name}。` };
}

export function addBlessing(progression, blessing) {
  if (!progression.run.guildId) return { progression, ok: false, reason: '请先选择商会。' };
  if (blessing.guild !== progression.run.guildId) return { progression, ok: false, reason: '这不是本商会的词条。' };
  if (progression.run.blessings.includes(blessing.id)) return { progression, ok: false, reason: '这个词条已经拥有。' };
  return { progression: { ...progression, run: { ...progression.run, blessings: [...progression.run.blessings, blessing.id] } }, ok: true, reason: `已获得「${blessing.name}」。` };
}

export function buildTier(blessingCount) {
  if (blessingCount >= 4) return 3;
  if (blessingCount >= 3) return 2;
  if (blessingCount >= 2) return 1;
  return 0;
}

export const buildMultiplier = blessingCount => [1, 1.1, 1.2, 1.35][buildTier(blessingCount)];

export function settleRun(progression, { returnPercent, maxDrawdown }) {
  // 完成一轮至少获得 2 声望，确保首轮即可解锁一个永久能力节点。
  const gain = Math.max(2, Math.round(2 + Math.max(0, returnPercent) * 12 + Math.max(0, 5 - maxDrawdown) * .15));
  const renown = progression.renown + gain;
  const unlockedKnowledge = [...progression.unlockedKnowledge];
  if (renown >= 3 && !unlockedKnowledge.includes('TREND_CHART')) unlockedKnowledge.push('TREND_CHART');
  if (renown >= 8 && !unlockedKnowledge.includes('EVENT_OMEN')) unlockedKnowledge.push('EVENT_OMEN');
  return { progression: { renown, unlockedKnowledge, run: { guildId: null, blessings: [] } }, gain };
}
