import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulateMinimalExperiment } from '../src/headless-simulator.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultOutputDirectory = path.resolve(scriptDirectory, '../analysis/generated');
const outputDirectory = path.resolve(process.argv[2] ?? defaultOutputDirectory);

const columns = {
  runs: ['run_id', 'market_seed', 'offer_seed', 'renown_start', 'guild_id', 'strategy_id', 'blessing_ids', 'start_cash', 'final_worth', 'total_return', 'max_drawdown', 'operating_income', 'blessing_income', 'auto_trades', 'renown_gain'],
  days: ['run_id', 'day', 'net_worth', 'cash', 'daily_return', 'drawdown', 'operating_income', 'blessing_income', 'auto_trades', 'market_regime'],
  stock_days: ['run_id', 'day', 'stock_id', 'price', 'fair_value', 'trend', 'shares', 'position_value', 'operating_income'],
};

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows, headers) {
  return `${[headers, ...rows.map(row => headers.map(header => row[header]))]
    .map(row => row.map(csvCell).join(','))
    .join('\n')}\n`;
}

const data = simulateMinimalExperiment();
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDirectory, 'runs.csv'), toCsv(data.runs, columns.runs), 'utf8'),
  writeFile(path.join(outputDirectory, 'days.csv'), toCsv(data.days, columns.days), 'utf8'),
  writeFile(path.join(outputDirectory, 'stock_days.csv'), toCsv(data.stockDays, columns.stock_days), 'utf8'),
  writeFile(path.join(outputDirectory, 'experiment.json'), `${JSON.stringify({
    experiment_id: 'minimal-hold-smoke-v1',
    generated_at: new Date().toISOString(),
    purpose: '模拟器冒烟测试；20 个种子不用于正式平衡推断。',
    formal_rule_modules: [
      'src/game-config.mjs',
      'src/daily-inputs.mjs',
      'src/random.mjs',
      'src/game-runtime.mjs',
      'src/market.mjs',
      'src/portfolio.mjs',
    ],
    analysis_only_conventions: {
      day_0: '选择 ALCHEMY、不领取词条，并按策略建仓后；第一次市场推进前的资产快照。',
      market_days: '每次正式 advanceRuntimeDay 完成后记录为分析 day=1..12。',
      final_day: 'day=12 记录正式第 12 日结束后的自动清仓结果；持仓为 0，价格保留最终市场价。',
      total_return: 'final_worth / start_cash - 1',
      drawdown: 'max(1 - net_worth / running_peak)，含 day=0。',
    },
    known_issues: [
      '正式 game-runtime.mjs 当前向 settleRun 传入 maxDrawdown=0；renown_gain 是现行正式结果，不代表分析层回撤已进入声望。',
      'progression.mjs 的回撤参数单位仍待单独核对。',
    ],
    config: {
      market_seeds: { start: 0, end: 19, count: 20 },
      common_random_numbers: true,
      offer_seed_equals_market_seed: true,
      start_cash: 400,
      renown_start: 0,
      guild_id: 'ALCHEMY',
      blessing_policy: 'NONE',
      automation_rules: [],
      market_days: 12,
      strategies: ['cash_control', 'moon_hold', 'sky_hold', 'crystal_hold'],
    },
    row_counts: {
      runs: data.runs.length,
      days: data.days.length,
      stock_days: data.stockDays.length,
    },
  }, null, 2)}\n`, 'utf8'),
]);

console.log(JSON.stringify({ outputDirectory, rowCounts: { runs: data.runs.length, days: data.days.length, stockDays: data.stockDays.length } }, null, 2));
