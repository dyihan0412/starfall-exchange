import { createDailyInputs } from './daily-inputs.mjs';
import { companyBlueprints, events, regimes } from './game-config.mjs';
import { act, advanceRuntimeDay, chooseRuntimeGuild, createRuntime } from './game-runtime.mjs';
import { createCompany, pricesOf } from './market.mjs';
import { createSeededRandom } from './random.mjs';
import { netWorth } from './portfolio.mjs';

const MARKET_DAYS = 12;
function round(value) {
  const rounded = Math.round((value + Number.EPSILON) * 1e8) / 1e8;
  const nearestInteger = Math.round(rounded);
  return Math.abs(rounded - nearestInteger) < 1e-7 ? nearestInteger : rounded;
}
const sum = values => values.reduce((total, value) => total + value, 0);

export const minimalStrategies = [
  { id: 'cash_control', stockId: null },
  { id: 'moon_hold', stockId: 'moon' },
  { id: 'sky_hold', stockId: 'sky' },
  { id: 'crystal_hold', stockId: 'crystal' },
];

const createCompanies = () => companyBlueprints.map(blueprint => createCompany(blueprint));

function blessingIncome(runtime) {
  return sum(Object.values(runtime.effectLedger).map(entry => entry.cashGained ?? 0));
}

function incomeByStock(runtime) {
  return Object.fromEntries(companyBlueprints.map(company => [company.id, runtime.incomeLedger[company.id] ?? 0]));
}

function stockRows(runtime, runId, analysisDay, dailyOperatingIncome = {}) {
  return Object.values(runtime.core.market.companies).map(company => {
    const shares = runtime.core.portfolio.holdings[company.id] ?? 0;
    return {
      run_id: runId,
      day: analysisDay,
      stock_id: company.id,
      price: company.price,
      fair_value: company.value,
      trend: company.trend,
      shares,
      position_value: round(shares * company.price),
      operating_income: round(dailyOperatingIncome[company.id] ?? 0),
    };
  });
}

/**
 * 跑一个无界面轮回。
 *
 * day=0 是分析快照：建仓后、第一次市场推进前。随后每次调用正式
 * advanceRuntimeDay，并将完成的市场日映射为分析 day=1..12。
 */
export function simulateRun({
  marketSeed,
  offerSeed = marketSeed,
  strategyId,
  stockId = null,
  startCash = 400,
  renownStart = 0,
  guildId = 'ALCHEMY',
} = {}) {
  if (!Number.isInteger(marketSeed) || marketSeed < 0) throw new Error('marketSeed 必须是非负整数。');
  if (!strategyId) throw new Error('strategyId 不能为空。');

  const runId = `seed-${String(marketSeed).padStart(4, '0')}__${strategyId}`;
  const random = createSeededRandom(marketSeed);
  let runtime = createRuntime({
    companies: createCompanies(),
    cash: startCash,
    renown: renownStart,
    offerSeed,
  });
  const guildChoice = chooseRuntimeGuild(runtime, guildId);
  if (!guildChoice.ok) throw new Error(`选择商会失败：${guildChoice.reason}`);
  runtime = guildChoice.runtime;

  if (stockId) {
    runtime = act(runtime, {
      type: 'BUY_PERCENT',
      stockId,
      percent: 1,
      source: 'SIMULATION_STRATEGY',
    });
    if (!runtime.core.lastActionResult?.ok) {
      throw new Error(`${strategyId} 首次建仓失败：${runtime.core.log.at(-1)?.message ?? '未知原因'}`);
    }
  }

  const days = [];
  const stockDays = [];
  let previousWorth = netWorth(runtime.core.portfolio, pricesOf(runtime.core.market));
  let runningPeak = previousWorth;
  days.push({
    run_id: runId,
    day: 0,
    net_worth: round(previousWorth),
    cash: runtime.core.portfolio.cash,
    daily_return: null,
    drawdown: 0,
    operating_income: 0,
    blessing_income: 0,
    auto_trades: 0,
    market_regime: runtime.core.market.regime,
  });
  stockDays.push(...stockRows(runtime, runId, 0));

  for (let day = 1; day <= MARKET_DAYS; day += 1) {
    const operatingBefore = incomeByStock(runtime);
    const blessingBefore = blessingIncome(runtime);
    runtime = advanceRuntimeDay(runtime, createDailyInputs({
      companies: companyBlueprints,
      regimes,
      events,
      random,
    }));

    const operatingAfter = incomeByStock(runtime);
    const dailyOperatingByStock = Object.fromEntries(companyBlueprints.map(company => [
      company.id,
      round(operatingAfter[company.id] - operatingBefore[company.id]),
    ]));
    const dailyOperating = sum(Object.values(dailyOperatingByStock));
    const dailyBlessing = blessingIncome(runtime) - blessingBefore;
    const worth = netWorth(runtime.core.portfolio, pricesOf(runtime.core.market));
    runningPeak = Math.max(runningPeak, worth);
    const drawdown = runningPeak > 0 ? 1 - worth / runningPeak : 0;

    days.push({
      run_id: runId,
      day,
      net_worth: round(worth),
      cash: runtime.core.portfolio.cash,
      daily_return: round(worth / previousWorth - 1),
      drawdown: round(drawdown),
      operating_income: round(dailyOperating),
      blessing_income: round(dailyBlessing),
      auto_trades: runtime.lastDaySummary?.autoTrades ?? 0,
      market_regime: runtime.core.market.regime,
    });
    stockDays.push(...stockRows(runtime, runId, day, dailyOperatingByStock));
    previousWorth = worth;
  }

  if (!runtime.settled || runtime.core.phase !== 'REPORT') throw new Error(`${runId} 未完成正式轮回结算。`);
  const finalWorth = runtime.settlement.worth;
  const operatingIncome = sum(Object.values(runtime.incomeLedger));
  const totalBlessingIncome = blessingIncome(runtime);
  const autoTrades = sum(days.map(day => day.auto_trades));
  const maxDrawdown = Math.max(...days.map(day => day.drawdown));

  return {
    run: {
      run_id: runId,
      market_seed: marketSeed,
      offer_seed: offerSeed,
      renown_start: renownStart,
      guild_id: guildId,
      strategy_id: strategyId,
      blessing_ids: JSON.stringify([]),
      start_cash: startCash,
      final_worth: round(finalWorth),
      total_return: round(finalWorth / startCash - 1),
      max_drawdown: round(maxDrawdown),
      operating_income: round(operatingIncome),
      blessing_income: round(totalBlessingIncome),
      auto_trades: autoTrades,
      renown_gain: runtime.settlement.gain,
    },
    days,
    stockDays,
  };
}

export function simulateMinimalExperiment({ seeds = Array.from({ length: 20 }, (_, seed) => seed) } = {}) {
  const results = seeds.flatMap(marketSeed => minimalStrategies.map(strategy => simulateRun({
    marketSeed,
    offerSeed: marketSeed,
    strategyId: strategy.id,
    stockId: strategy.stockId,
  })));
  return {
    runs: results.map(result => result.run),
    days: results.flatMap(result => result.days),
    stockDays: results.flatMap(result => result.stockDays),
  };
}
