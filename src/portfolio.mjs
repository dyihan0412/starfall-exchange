/** 交易账本：不依赖网页、计时器或市场生成逻辑。 */
export function createPortfolio(cash = 400) {
  return { cash, holdings: {}, transactions: [] };
}

export function sharesOf(portfolio, stockId) {
  return portfolio.holdings[stockId] ?? 0;
}

const round = value => Math.round((value + Number.EPSILON) * 1e8) / 1e8;

export function netWorth(portfolio, prices) {
  return portfolio.cash + Object.entries(portfolio.holdings)
    .reduce((sum, [id, shares]) => sum + shares * prices[id], 0);
}

function result(portfolio, ok, reason, transaction = null) {
  return { portfolio, ok, reason, transaction };
}

export function buyByCash(portfolio, stockId, price, cashAmount, day = 1, shareMultiplier = 1) {
  if (!Number.isFinite(price) || price <= 0) return result(portfolio, false, '价格无效');
  if (!Number.isFinite(cashAmount) || cashAmount <= 0) return result(portfolio, false, '买入金额无效');
  if (cashAmount > portfolio.cash) return result(portfolio, false, '可用资金不足');
  if (!Number.isFinite(shareMultiplier) || shareMultiplier < 1) return result(portfolio, false, '资金效率加成无效');
  const baseShares = cashAmount / price;
  const shares = baseShares * shareMultiplier;
  const transaction = { type: 'BUY', stockId, price, shares, cashAmount, day, bonusShares: shares - baseShares };
  return result({
    cash: round(portfolio.cash - cashAmount),
    holdings: { ...portfolio.holdings, [stockId]: round(sharesOf(portfolio, stockId) + shares) },
    transactions: [...portfolio.transactions, transaction],
  }, true, '买入成功', transaction);
}

export function buyByShares(portfolio, stockId, price, shares, day = 1, shareMultiplier = 1) {
  if (!Number.isFinite(shares) || shares <= 0) return result(portfolio, false, '买入数量无效');
  return buyByCash(portfolio, stockId, price, shares * price, day, shareMultiplier);
}

export function sellByShares(portfolio, stockId, price, shares, day = 1) {
  if (!Number.isFinite(price) || price <= 0) return result(portfolio, false, '价格无效');
  if (!Number.isFinite(shares) || shares <= 0) return result(portfolio, false, '卖出数量无效');
  if (shares > sharesOf(portfolio, stockId)) return result(portfolio, false, '持仓不足');
  const cashAmount = shares * price;
  const transaction = { type: 'SELL', stockId, price, shares, cashAmount, day };
  return result({
    cash: round(portfolio.cash + cashAmount),
    holdings: { ...portfolio.holdings, [stockId]: round(sharesOf(portfolio, stockId) - shares) },
    transactions: [...portfolio.transactions, transaction],
  }, true, '卖出成功', transaction);
}

export function liquidate(portfolio, prices, day = 1) {
  return Object.entries(portfolio.holdings).reduce((current, [stockId, shares]) => {
    return shares > 0 ? sellByShares(current, stockId, prices[stockId], shares, day).portfolio : current;
  }, portfolio);
}

export function creditCash(portfolio, amount, note = '收益', day = 1, stockId = null, source = 'SYSTEM') {
  return { ...portfolio, cash: round(portfolio.cash + amount), transactions: [...portfolio.transactions, { type: 'CREDIT', cashAmount: amount, note, day, stockId, source }] };
}

/** 从真实成交逐笔还原剩余仓位成本；卖出按当时的移动平均成本扣减。 */
export function positionSummary(portfolio, stockId, currentPrice = 0) {
  let shares = 0;
  let cost = 0;
  for (const transaction of portfolio.transactions) {
    if (transaction.stockId !== stockId) continue;
    if (transaction.type === 'BUY') {
      shares += transaction.shares;
      cost += transaction.cashAmount;
    } else if (transaction.type === 'SELL' && shares > 0) {
      const sold = Math.min(shares, transaction.shares);
      cost -= sold * (cost / shares);
      shares -= sold;
    }
  }
  if (shares < 1e-7) return { shares: 0, averageCost: 0, marketValue: 0, unrealizedProfit: 0 };
  const averageCost = round(cost / shares);
  return { shares: round(shares), averageCost, marketValue: round(shares * currentPrice), unrealizedProfit: round(shares * (currentPrice - averageCost)) };
}
