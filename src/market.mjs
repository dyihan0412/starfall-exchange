/** 市场环境：价值、代理人力量和事件共同形成价格，不读取玩家资产。 */
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function createCompany({
  id, name, value, price, volatility, growth = 0, category = 'BALANCED',
  meanReversion = .25, momentum = .2, sentimentSensitivity = 1, eventSensitivity = 1,
  incomeRate = 0, incomeRule = 'ALWAYS', incomeLabel = '经营回款', beta = 1, priceLimit = null,
}) {
  const resolvedPriceLimit = priceLimit ?? clamp(volatility * 2.5, .05, .18);
  return {
    id, name, value, price, volatility, growth, category,
    meanReversion, momentum, sentimentSensitivity, eventSensitivity,
    incomeRate, incomeRule, incomeLabel, beta, priceLimit: resolvedPriceLimit,
    trend: 0, history: [price], valueHistory: [value],
    lastMove: { returnRate: 0, dominant: '开盘', summary: '等待第一个市场日结算。', drivers: {} },
  };
}

/** 公司经营现金流：只计算每股回款率，不读取玩家持仓。 */
export function operatingIncomeRate(company, day) {
  if (company.incomeRule === 'TREND_UP') return company.trend > 0 ? company.incomeRate : company.incomeRate * .2;
  if (company.incomeRule === 'HIGH_VOLATILITY') return Math.abs(company.trend) >= .03 ? company.incomeRate : company.incomeRate * .15;
  if (company.incomeRule === 'CYCLE_3') return day % 3 === 0 ? company.incomeRate : company.incomeRate * .1;
  return company.incomeRate;
}

export function applyMarketDay(company, {
  businessChange = 0, sentiment = 0, eventChange = 0, eventPriceChange = 0,
  eventLabel = '', valuationPullMultiplier = 1, marketChange = 0, sectorChange = 0, liquidityShock = 0,
} = {}) {
  const nextValue = round(Math.max(1, company.value * (1 + businessChange + eventChange)));
  const valueGap = (nextValue - company.price) / company.price;
  const drivers = {
    value: valueGap * company.meanReversion * valuationPullMultiplier,
    trend: company.trend * company.momentum,
    sentiment: sentiment * company.sentimentSensitivity,
    event: eventPriceChange * company.eventSensitivity,
    macro: marketChange * (company.beta ?? 1),
    sector: sectorChange * (.7 + company.sentimentSensitivity * .3),
    liquidity: liquidityShock,
  };
  const rawReturn = Object.values(drivers).reduce((sum, value) => sum + value, 0);
  const priceLimit = company.priceLimit ?? clamp(company.volatility * 2.5, .05, .18);
  const returnRate = clamp(rawReturn, -priceLimit, priceLimit);
  const limitHit = Math.abs(rawReturn) > priceLimit;
  const nextPrice = round(Math.max(1, company.price * (1 + returnRate)));
  const trend = round((nextPrice - company.price) / company.price);
  const dominantEntry = Object.entries(drivers).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  const driverNames = { value: '价值回归', trend: '趋势资金', sentiment: '市场情绪', event: '公司事件', macro: '大盘环境', sector: '板块轮动', liquidity: '流动性' };
  const dominant = Math.abs(dominantEntry[1]) < .0005 ? '多空平衡' : driverNames[dominantEntry[0]];
  const direction = trend > .001 ? '上涨' : trend < -.001 ? '下跌' : '横盘';
  const eventText = eventLabel ? `；事件：${eventLabel}` : '';
  const limitText = limitHit ? `；触及${returnRate > 0 ? '涨' : '跌'}幅限制` : '';
  return {
    ...company,
    value: nextValue,
    price: nextPrice,
    trend,
    history: [...company.history, nextPrice],
    valueHistory: [...(company.valueHistory ?? [company.value]), nextValue],
    lastMove: {
      returnRate: trend,
      dominant,
      summary: `${dominant}主导，价格${direction}${eventText}${limitText}`,
      drivers: Object.fromEntries(Object.entries(drivers).map(([key, value]) => [key, round(value * 100)])),
      eventLabel,
      limitHit,
      priceLimit,
    },
  };
}

export function createMarket(companies) {
  return { day: 1, companies: Object.fromEntries(companies.map(company => [company.id, company])), events: [], regime: '常态交易', sectorLead: '无明显主线' };
}

export function pricesOf(market) {
  return Object.fromEntries(Object.values(market.companies).map(company => [company.id, company.price]));
}

export function advanceMarket(market, dailyInputs) {
  const companies = Object.fromEntries(Object.entries(market.companies).map(([id, company]) => [id, applyMarketDay(company, dailyInputs[id])]));
  const events = Object.entries(dailyInputs).flatMap(([stockId, input]) => input.eventLabel ? [{ day: market.day + 1, stockId, label: input.eventLabel }] : []);
  return { ...market, day: market.day + 1, companies, events: [...market.events, ...events], regime: dailyInputs.__regime ?? market.regime, sectorLead: dailyInputs.__sectorLead ?? market.sectorLead };
}
