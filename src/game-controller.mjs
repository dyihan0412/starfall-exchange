import { buyByCash, buyByShares, sellByShares } from './portfolio.mjs';
import { advanceMarket, pricesOf } from './market.mjs';

/** 主持人：只编排模块，不在这里重复买卖或价格公式。 */
export function createGameState({ portfolio, market }) {
  return { day: 1, portfolio, market, log: [], phase: 'PLAYING' };
}

const record = (state, message) => ({ ...state, log: [...state.log, { day: state.day, message }] });

export function dispatch(state, action) {
  if (state.phase !== 'PLAYING') return record(state, '轮回已经结束，无法继续操作。');
  const price = state.market.companies[action.stockId]?.price;
  const normalized = normalizeTradeAction(action);
  if (!normalized || !price) return record({ ...state, lastActionResult: { ok: false } }, '未知操作被忽略。');
  let result;
  const held = state.portfolio.holdings[action.stockId] ?? 0;
  if (normalized.side === 'BUY' && normalized.quantityMode === 'PERCENT') result = buyByCash(state.portfolio, action.stockId, price, state.portfolio.cash * normalized.value, state.day, action.shareMultiplier);
  else if (normalized.side === 'BUY' && normalized.quantityMode === 'CASH') result = buyByCash(state.portfolio, action.stockId, price, normalized.value, state.day, action.shareMultiplier);
  else if (normalized.side === 'BUY' && normalized.quantityMode === 'SHARES') result = buyByShares(state.portfolio, action.stockId, price, normalized.value, state.day, action.shareMultiplier);
  else if (normalized.side === 'SELL' && normalized.quantityMode === 'PERCENT') result = sellByShares(state.portfolio, action.stockId, price, held * normalized.value, state.day);
  else if (normalized.side === 'SELL' && normalized.quantityMode === 'CASH') result = sellByShares(state.portfolio, action.stockId, price, normalized.value / price, state.day);
  else if (normalized.side === 'SELL' && normalized.quantityMode === 'SHARES') result = sellByShares(state.portfolio, action.stockId, price, normalized.value, state.day);
  else return record({ ...state, lastActionResult: { ok: false } }, '未知操作被忽略。');
  return record({ ...state, portfolio: result.portfolio, lastActionResult: { ok: result.ok, transaction: result.transaction, action: normalized } }, result.ok ? result.reason : `交易失败：${result.reason}`);
}

export function normalizeTradeAction(action) {
  if (action.type === 'TRADE') return { side: action.side, quantityMode: action.quantityMode, value: Number(action.value) };
  if (action.type === 'BUY_PERCENT') return { side: 'BUY', quantityMode: 'PERCENT', value: Number(action.percent) };
  if (action.type === 'SELL_PERCENT') return { side: 'SELL', quantityMode: 'PERCENT', value: Number(action.percent) };
  if (action.type === 'BUY_CASH') return { side: 'BUY', quantityMode: 'CASH', value: Number(action.cashAmount) };
  if (action.type === 'SELL_CASH') return { side: 'SELL', quantityMode: 'CASH', value: Number(action.cashAmount) };
  if (action.type === 'BUY_SHARES') return { side: 'BUY', quantityMode: 'SHARES', value: Number(action.shares) };
  if (action.type === 'SELL_SHARES') return { side: 'SELL', quantityMode: 'SHARES', value: Number(action.shares) };
  return null;
}

export function advanceDay(state, dailyMarketInputs) {
  if (state.phase !== 'PLAYING') return state;
  // 本项目明确的结算顺序：市场变化 → 分红/自动策略（下一步加入） → 新的一日。
  const market = advanceMarket(state.market, dailyMarketInputs);
  const day = state.day + 1;
  const phase = day > 12 ? 'REPORT' : 'PLAYING';
  return record({ ...state, day, market, phase }, phase === 'REPORT' ? '第 12 日结束，进入轮回报告。' : '市场日结算完成。');
}

export function snapshot(state) {
  return { day: state.day, phase: state.phase, prices: pricesOf(state.market), portfolio: state.portfolio, log: state.log };
}
