import { createPortfolio, netWorth, liquidate, creditCash } from './portfolio.mjs';
import { createMarket, pricesOf, operatingIncomeRate } from './market.mjs';
import { createGameState, dispatch, advanceDay, snapshot, normalizeTradeAction } from './game-controller.mjs';
import { evaluateRules } from './strategy-engine.mjs';
import { createProgression, chooseGuild, addBlessing, settleRun, blessings, blessingPoolFor, buildTier, buildMultiplier, routeMultiplierFor, buildRouteSummary, metaProgressFor } from './progression.mjs';
import { createTelemetry, track } from './telemetry.mjs';
import { LocalMarketAdvisor } from './advisor-port.mjs';

const MAX_MARKET_DAY = 12;
const BLESSING_DAYS = [1, 4, 7, 10];
const round = value => Math.round((value + Number.EPSILON) * 1e8) / 1e8;

export function createRuntime({ companies, cash = 400, advisor = new LocalMarketAdvisor(), renown = 0, knowledge, offerSeed = Math.floor(cash * 100) + renown * 97 } = {}) {
  const core = createGameState({ portfolio: createPortfolio(cash), market: createMarket(companies) });
  return { core, startCash: cash, offerSeed, progression: createProgression({ renown, unlockedKnowledge: knowledge }), telemetry: createTelemetry(), rules: [], mailbox: [], effectLedger: {}, incomeLedger: {}, runEffects: { quickTurnoverReady: false, highestTier: 0 }, lastDaySummary: null, lastMilestone: null, advisor, settled: false };
}

export function restoreRuntime(saved, advisor = new LocalMarketAdvisor()) {
  return { mailbox: [], effectLedger: {}, incomeLedger: {}, runEffects: { quickTurnoverReady: false, highestTier: 0 }, lastDaySummary: null, lastMilestone: null, ...saved, advisor };
}

function createMail(runtime, day) {
  const guildId = runtime.progression.run.guildId;
  const unlocked = new Set(metaProgressFor(runtime.progression.renown).unlockedStocks);
  const pool = blessingPoolFor(guildId).filter(item => {
    const targets = item.effect.targets;
    return !Array.isArray(targets) || targets.length === 0 || targets.some(id => unlocked.has(id));
  });
  if (!pool.length) return null;
  const mailIndex = BLESSING_DAYS.indexOf(day);
  if (mailIndex < 0) return null;
  const used = new Set(runtime.mailbox.flatMap(mail => mail.offerIds));
  const owned = new Set(runtime.progression.run.blessings);
  const offset = Math.abs((runtime.offerSeed ?? 0) + mailIndex * 5) % pool.length;
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
  const candidates = [...rotated.filter(item => !used.has(item.id) && !owned.has(item.id)), ...rotated.filter(item => !owned.has(item.id))];
  const offerIds = [...new Set(candidates.map(item => item.id))].slice(0, 2);
  return offerIds.length === 2 ? { id: `DAY_${day}`, day, offerIds, claimed: false, selectedBlessingId: null } : null;
}

function appendDailyMail(runtime, day) {
  if (!BLESSING_DAYS.includes(day) || !runtime.progression.run.guildId || runtime.mailbox.some(mail => mail.day === day)) return runtime;
  const mail = createMail(runtime, day);
  return mail ? { ...runtime, mailbox: [...runtime.mailbox, mail] } : runtime;
}

function recordEffect(runtime, blessingId, detail, cashGained = 0) {
  const current = runtime.effectLedger[blessingId] ?? { triggers: 0, cashGained: 0, lastDay: null, detail: '' };
  return { ...runtime, effectLedger: { ...runtime.effectLedger, [blessingId]: { triggers: current.triggers + 1, cashGained: round(current.cashGained + cashGained), lastDay: runtime.core.day, detail } } };
}

const ownedBlessings = runtime => runtime.progression.run.blessings.map(id => blessings[id]).filter(Boolean);
const effectMultiplier = (runtime, blessing) => buildMultiplier(runtime.progression.run.blessings.length) * routeMultiplierFor(blessing, runtime.progression.run.blessings);
const targetsFor = (effect, core) => effect.targets === '*' ? Object.keys(core.market.companies) : (effect.targets ?? []);

function conditionMatches(condition, company, core, targets = []) {
  if (!condition) return true;
  if (condition === 'TREND_UP') return company?.trend > 0;
  if (condition === 'TREND_DOWN') return company?.trend < 0;
  if (condition === 'UNDERVALUED') return company && company.price < company.value;
  if (condition === 'SEVERE_UNDERVALUED') return company && company.price / company.value < .9;
  if (condition === 'HIGH_VOLATILITY') return company && Math.abs(company.trend) >= .03;
  if (condition === 'EXTREME_VOLATILITY') return company && Math.abs(company.trend) >= .04;
  if (condition === 'ANY_TREND_UP') return targets.some(id => core.market.companies[id]?.trend > 0);
  return false;
}

export function chooseRuntimeGuild(runtime, guildId) {
  const picked = chooseGuild(runtime.progression, guildId);
  if (!picked.ok) return { runtime, ok: false, reason: picked.reason };
  let next = { ...runtime, progression: picked.progression, mailbox: [], effectLedger: {}, runEffects: { quickTurnoverReady: false, highestTier: 0 }, lastDaySummary: null, lastMilestone: null, telemetry: track(runtime.telemetry, 'GUILD_CHOSEN', { guildId }, runtime.core.day) };
  next = appendDailyMail(next, 1);
  return { runtime: next, ok: true, reason: picked.reason };
}

export function setRules(runtime, rules) {
  const meta = metaProgressFor(runtime.progression.renown);
  const allowedStocks = new Set(meta.unlockedStocks);
  const valid = rules.filter(rule => allowedStocks.has(rule.stockId)).map(rule => meta.compoundConditions ? rule : { ...rule, secondTrigger: null, secondThreshold: 0 });
  return { ...runtime, rules: valid.slice(0, meta.ruleSlots) };
}

export function chooseBlessing(runtime, blessingId, mailId = null) {
  const mailIndex = runtime.mailbox.findIndex(mail => !mail.claimed && (!mailId || mail.id === mailId) && mail.offerIds.includes(blessingId));
  if (mailIndex < 0 || !blessings[blessingId]) return { runtime, ok: false, reason: '这张卡不在可领取邮件中。' };
  const result = addBlessing(runtime.progression, blessings[blessingId]);
  if (!result.ok) return { runtime, ok: false, reason: result.reason };
  const mailbox = runtime.mailbox.map((mail, index) => index === mailIndex ? { ...mail, claimed: true, selectedBlessingId: blessingId } : mail);
  const tier = buildTier(result.progression.run.blessings.length);
  const reachedTier = tier > runtime.runEffects.highestTier;
  return {
    runtime: {
      ...runtime,
      mailbox,
      progression: result.progression,
      runEffects: { ...runtime.runEffects, highestTier: Math.max(runtime.runEffects.highestTier, tier) },
      lastMilestone: reachedTier ? { tier, count: result.progression.run.blessings.length, multiplier: buildMultiplier(result.progression.run.blessings.length), nonce: `${runtime.core.day}-${tier}` } : runtime.lastMilestone,
      telemetry: track(runtime.telemetry, 'BLESSING_CHOSEN', { blessingId, mailId: runtime.mailbox[mailIndex].id, tier }, runtime.core.day),
    },
    ok: true,
    reason: reachedTier ? `${result.reason} 构筑升至 ${tier} 阶，词条效果 +${Math.round((buildMultiplier(result.progression.run.blessings.length) - 1) * 100)}%！` : result.reason,
  };
}

const sideOf = action => normalizeTradeAction(action)?.side;

function tradeBonus(runtime, action) {
  if (sideOf(action) !== 'BUY') return 0;
  const company = runtime.core.market.companies[action.stockId];
  return ownedBlessings(runtime)
    .filter(item => item.effect.stage === 'TRADE' && item.effect.type === 'BUY_BONUS' && conditionMatches(item.effect.condition, company, runtime.core))
    .reduce((sum, item) => sum + item.effect.amount * effectMultiplier(runtime, item), 0);
}

export function act(runtime, action) {
  if (!metaProgressFor(runtime.progression.renown).unlockedStocks.includes(action.stockId)) {
    const message = '该公司尚未获得市场准入。';
    return { ...runtime, core: { ...runtime.core, lastActionResult: { ok: false, reason: message }, log: [...runtime.core.log, { day: runtime.core.day, message }] } };
  }
  const effects = ownedBlessings(runtime).filter(item => item.effect.stage === 'TRADE');
  const turnover = effects.find(item => item.effect.type === 'TURNOVER');
  const usesTurnover = turnover && runtime.runEffects.quickTurnoverReady && sideOf(action) === 'BUY';
  const bonus = tradeBonus(runtime, action) + (usesTurnover ? turnover.effect.amount * effectMultiplier(runtime, turnover) : 0);
  const core = dispatch(runtime.core, bonus > 0 ? { ...action, shareMultiplier: 1 + bonus } : action);
  const succeeded = core.lastActionResult?.ok === true;
  let next = { ...runtime, core, telemetry: succeeded ? track(runtime.telemetry, 'TRADE_EXECUTED', { source: action.source ?? 'MANUAL', stockId: action.stockId }, runtime.core.day) : runtime.telemetry };
  if (!succeeded) return next;

  if (turnover && sideOf(action) === 'SELL') {
    next = { ...next, runEffects: { ...next.runEffects, quickTurnoverReady: true } };
    next = recordEffect(next, turnover.id, `周转已就绪：下一次买入额外获得 ${(turnover.effect.amount * effectMultiplier(runtime, turnover) * 100).toFixed(1)}% 股份`);
  } else if (usesTurnover) {
    next = { ...next, runEffects: { ...next.runEffects, quickTurnoverReady: false } };
    next = recordEffect(next, turnover.id, `本次买入额外获得 ${(turnover.effect.amount * effectMultiplier(runtime, turnover) * 100).toFixed(1)}% 股份`);
  }
  for (const item of effects.filter(entry => entry.effect.type === 'BUY_BONUS')) {
    const company = runtime.core.market.companies[action.stockId];
    if (sideOf(action) === 'BUY' && conditionMatches(item.effect.condition, company, runtime.core)) next = recordEffect(next, item.id, `本次买入额外获得 ${(item.effect.amount * effectMultiplier(runtime, item) * 100).toFixed(1)}% 股份`);
  }
  if (sideOf(action) === 'SELL') {
    for (const item of effects.filter(entry => entry.effect.type === 'SALE_REBATE')) {
      const amount = core.lastActionResult.transaction.cashAmount * item.effect.amount * effectMultiplier(runtime, item);
      next = { ...next, core: { ...next.core, portfolio: creditCash(next.core.portfolio, amount, item.name, next.core.day, action.stockId, 'BLESSING') } };
      next = recordEffect(next, item.id, `卖出返利 +${amount.toFixed(2)} 星铢`, amount);
    }
  }
  return next;
}

function applyOperatingIncome(runtime) {
  let next = runtime;
  let total = 0;
  const entries = [];
  const metaMultiplier = metaProgressFor(runtime.progression.renown).incomeMultiplier;
  for (const company of Object.values(runtime.core.market.companies)) {
    const shares = runtime.core.portfolio.holdings[company.id] ?? 0;
    if (shares <= 0) continue;
    const rate = operatingIncomeRate(company, runtime.core.day);
    const amount = shares * company.price * rate * metaMultiplier;
    if (amount <= 0) continue;
    next = { ...next, core: { ...next.core, portfolio: creditCash(next.core.portfolio, amount, `${company.name}·${company.incomeLabel}`, next.core.day, company.id, 'OPERATING_INCOME') } };
    next = { ...next, incomeLedger: { ...next.incomeLedger, [company.id]: round((next.incomeLedger[company.id] ?? 0) + amount) } };
    total += amount;
    entries.push({ stockId: company.id, name: company.name, amount, rate });
  }
  return { runtime: next, total, entries };
}

function mutableInput(inputs, companyId) {
  inputs[companyId] ??= {};
  inputs[companyId].businessChange ??= 0;
  inputs[companyId].sentiment ??= 0;
  inputs[companyId].eventChange ??= 0;
  inputs[companyId].eventPriceChange ??= 0;
  inputs[companyId].valuationPullMultiplier ??= 1;
  return inputs[companyId];
}

function applyPreEffects(runtime, inputs) {
  let next = runtime;
  for (const item of ownedBlessings(runtime).filter(entry => entry.effect.stage === 'PRE')) {
    const effect = item.effect;
    const multiplier = effectMultiplier(runtime, item);
    const targets = targetsFor(effect, runtime.core);
    let applied = false;
    if (effect.type === 'GROUP_SENTIMENT' && conditionMatches(effect.condition, null, runtime.core, targets)) {
      for (const id of targets) mutableInput(inputs, id).sentiment += effect.amount * multiplier;
      applied = true;
    } else {
      for (const id of targets) {
        const company = runtime.core.market.companies[id];
        if (!company || !conditionMatches(effect.condition, company, runtime.core, targets)) continue;
        const input = mutableInput(inputs, id);
        if (effect.type === 'BUSINESS') input.businessChange += effect.amount * multiplier;
        if (effect.type === 'SENTIMENT') input.sentiment += effect.amount * multiplier;
        if (effect.type === 'PULL') input.valuationPullMultiplier *= 1 + effect.amount * multiplier;
        if (effect.type === 'EVENT_SHIELD') {
          if (input.eventChange < 0) input.eventChange *= 1 - Math.min(.9, effect.amount * multiplier);
          if (input.eventPriceChange < 0) input.eventPriceChange *= 1 - Math.min(.9, effect.amount * multiplier);
        }
        applied = true;
      }
    }
    if (applied) next = recordEffect(next, item.id, `第 ${runtime.core.day} 日效果已加入市场结算`);
  }
  return next;
}

function applyPostEffects(runtime, worthBefore) {
  let next = runtime;
  let cashIncome = 0;
  for (const item of ownedBlessings(runtime).filter(entry => entry.effect.stage === 'POST')) {
    const effect = item.effect;
    const multiplier = effectMultiplier(runtime, item);
    const targets = targetsFor(effect, next.core);
    let amount = 0;
    if (effect.type === 'CASH_FLAT') amount = effect.amount * multiplier;
    if (effect.type === 'CASH_RATE') amount = next.core.portfolio.cash * effect.amount * multiplier;
    if (effect.type === 'LOSS_CASH' && netWorth(next.core.portfolio, pricesOf(next.core.market)) < worthBefore) amount = effect.amount * multiplier;
    if (effect.type === 'TARGET_TREND_CASH' && targets.some(id => conditionMatches(effect.condition, next.core.market.companies[id], next.core))) amount = effect.amount * multiplier;
    if (effect.type === 'HOLDING_YIELD') {
      amount = targets.reduce((sum, id) => {
        const company = next.core.market.companies[id];
        if (!company || !conditionMatches(effect.condition, company, next.core)) return sum;
        return sum + (next.core.portfolio.holdings[id] ?? 0) * company.price * effect.amount * multiplier;
      }, 0);
    }
    if (amount > 0) {
      next = { ...next, core: { ...next.core, portfolio: creditCash(next.core.portfolio, amount, item.name, next.core.day, null, 'BLESSING') } };
      next = recordEffect(next, item.id, `本日入账 +${amount.toFixed(2)} 星铢`, amount);
      cashIncome += amount;
    }
  }
  return { runtime: next, cashIncome };
}

export function advanceRuntimeDay(runtime, dailyMarketInputs) {
  const worthBefore = netWorth(runtime.core.portfolio, pricesOf(runtime.core.market));
  const inputs = structuredClone(dailyMarketInputs);
  let next = applyPreEffects(runtime, inputs);
  next = { ...next, core: advanceDay(next.core, inputs) };

  let automaticActions = evaluateRules(next.core, next.rules);
  const autoEffect = ownedBlessings(next).find(item => item.effect.type === 'AUTO_SCALE');
  if (autoEffect) automaticActions = automaticActions.map(action => ({ ...action, value: Math.min(1, action.value * (1 + autoEffect.effect.amount * effectMultiplier(next, autoEffect))) }));
  automaticActions.forEach(action => { next = act(next, action); });
  if (autoEffect && automaticActions.length) next = recordEffect(next, autoEffect.id, `本日 ${automaticActions.length} 次自动交易获得比例加成`);

  const operating = applyOperatingIncome(next);
  next = operating.runtime;
  const post = applyPostEffects(next, worthBefore);
  next = post.runtime;
  const worthAfter = netWorth(next.core.portfolio, pricesOf(next.core.market));
  const movers = Object.values(next.core.market.companies).sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend));
  next = {
    ...next,
    latestBrief: next.advisor.brief(next.core),
    lastDaySummary: {
      day: next.core.day,
      worthBefore,
      worthAfter,
      change: worthAfter - worthBefore,
      changePercent: worthBefore ? (worthAfter / worthBefore - 1) : 0,
      cashIncome: post.cashIncome + operating.total,
      operatingIncome: operating.total,
      operatingEntries: operating.entries,
      autoTrades: automaticActions.length,
      topMover: movers[0] ? { id: movers[0].id, name: movers[0].name, trend: movers[0].trend } : null,
      regime: next.core.market.regime,
    },
  };

  if (next.core.phase === 'REPORT' && !next.settled) {
    const clearedPortfolio = liquidate(next.core.portfolio, pricesOf(next.core.market), next.core.day);
    next = { ...next, core: { ...next.core, portfolio: clearedPortfolio } };
    const worth = netWorth(next.core.portfolio, pricesOf(next.core.market));
    const settled = settleRun(next.progression, { returnPercent: worth / next.startCash - 1, maxDrawdown: 0 });
    next = { ...next, progression: settled.progression, settled: true, settlement: { gain: settled.gain, worth }, telemetry: track(next.telemetry, 'RUN_SETTLED', { worth, gain: settled.gain }, next.core.day) };
  } else if (next.core.phase === 'PLAYING' && next.core.day <= MAX_MARKET_DAY) next = appendDailyMail(next, next.core.day);
  return next;
}

export function runtimeSnapshot(runtime) {
  return { ...snapshot(runtime.core), progression: runtime.progression, rules: runtime.rules, mailbox: runtime.mailbox, effectLedger: runtime.effectLedger, incomeLedger: runtime.incomeLedger, runEffects: runtime.runEffects, routes: buildRouteSummary(runtime.progression.run.blessings), lastDaySummary: runtime.lastDaySummary, lastMilestone: runtime.lastMilestone, meta: metaProgressFor(runtime.progression.renown), latestBrief: runtime.latestBrief, settlement: runtime.settlement };
}
