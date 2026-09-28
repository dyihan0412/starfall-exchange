/**
 * 正式游戏静态配置。
 *
 * 网页和无界面模拟器共同读取这里，避免公司、市场环境和事件出现两套参数。
 */
export const companyBlueprints = [
  { id: 'moon', name: '月露药剂工坊', value: 100, price: 86, volatility: .02, category: 'STABLE', beta: .65, priceLimit: .06, meanReversion: .34, momentum: .08, sentimentSensitivity: .55, eventSensitivity: .7, incomeRate: .035, incomeRule: 'ALWAYS', incomeLabel: '药剂分红', role: '每日稳定分红 3.5%', clue: '防御型资产；对大盘不敏感，估值约束较强' },
  { id: 'bank', name: '星砂银行', value: 72, price: 75, volatility: .018, category: 'STABLE', beta: .55, priceLimit: .05, meanReversion: .42, momentum: .04, sentimentSensitivity: .4, eventSensitivity: .6, incomeRate: .025, incomeRule: 'ALWAYS', incomeLabel: '利息回款', role: '每日利息 2.5%', clue: '低贝塔资产；市场下行时通常更抗跌' },
  { id: 'sky', name: '浮空船坞', value: 80, price: 80, volatility: .04, category: 'GROWTH', beta: 1.2, priceLimit: .1, meanReversion: .18, momentum: .58, sentimentSensitivity: 1, eventSensitivity: 1, incomeRate: .06, incomeRule: 'TREND_UP', incomeLabel: '航线订单', role: '上涨日订单 6%', clue: '趋势与大盘共振明显，上涨阶段经营效率更高' },
  { id: 'forge', name: '魔像铸造厂', value: 92, price: 88, volatility: .045, category: 'GROWTH', beta: 1.05, priceLimit: .11, meanReversion: .2, momentum: .38, sentimentSensitivity: .85, eventSensitivity: 1.2, incomeRate: .1, incomeRule: 'CYCLE_3', incomeLabel: '批量交付', role: '每三日批量回款 10%', clue: '订单周期明显，板块行情会放大交付预期' },
  { id: 'crystal', name: '龙晶矿场', value: 68, price: 62, volatility: .075, category: 'SPECULATIVE', beta: 1.35, priceLimit: .16, meanReversion: .26, momentum: -.08, sentimentSensitivity: 1.45, eventSensitivity: 1.45, incomeRate: .075, incomeRule: 'HIGH_VOLATILITY', incomeLabel: '矿脉提炼', role: '高波动日提炼 7.5%', clue: '高贝塔事件股；大盘与矿业消息都会放大价格波动' },
  { id: 'dream', name: '梦境剧院', value: 55, price: 58, volatility: .09, category: 'SPECULATIVE', beta: 1.55, priceLimit: .18, meanReversion: .07, momentum: .82, sentimentSensitivity: 1.8, eventSensitivity: 1.55, incomeRate: .09, incomeRule: 'TREND_UP', incomeLabel: '票房分成', role: '上涨日票房 9%', clue: '高情绪、高动量；流动性变化可能迅速放大涨跌' },
];

export const events = {
  moon: [['稀有药材丰收', .025, .018], ['配方污染', -.03, -.025]],
  bank: [['王室存款流入', .018, .012], ['挤兑传闻', -.02, -.035]],
  sky: [['远航订单签署', .035, .025], ['引擎召回', -.035, -.03]],
  forge: [['军团追加订单', .04, .03], ['矿炉停摆', -.04, -.035]],
  crystal: [['发现富矿层', .05, .06], ['矿道坍塌', -.055, -.065]],
  dream: [['名角首演爆红', .025, .085], ['幻术事故', -.025, -.09]],
};

export const regimes = [
  { name: '商路繁荣', business: .004, sentiment: .006, market: .006 },
  { name: '谨慎观望', business: 0, sentiment: -.005, market: -.002 },
  { name: '投机升温', business: -.001, sentiment: .011, market: .004 },
  { name: '资金退潮', business: -.004, sentiment: -.012, market: -.009 },
];
