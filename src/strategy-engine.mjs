/** 自动策略：只读游戏状态，产出 Action；绝不直接修改投资组合。 */
export function createRule({ stockId, trigger, threshold = 0, secondTrigger = null, secondThreshold = 0, action, percent }) {
  return { stockId, trigger, threshold, secondTrigger, secondThreshold, action, percent, enabled: true };
}

function matchesTrigger(trigger, threshold, company) {
  const gap = (company.price - company.value) / company.value;
  if (trigger === 'BELOW_VALUE') return gap <= -threshold;
  if (trigger === 'ABOVE_VALUE') return gap >= threshold;
  if (trigger === 'TREND_UP') return company.trend > threshold;
  if (trigger === 'TREND_DOWN') return company.trend < -threshold;
  return false;
}

function matches(rule, company) {
  if (!matchesTrigger(rule.trigger, rule.threshold, company)) return false;
  return !rule.secondTrigger || matchesTrigger(rule.secondTrigger, rule.secondThreshold ?? 0, company);
}

export function evaluateRules(state, rules) {
  return rules.flatMap(rule => {
    const company = state.market.companies[rule.stockId];
    if (!rule.enabled || !company || !matches(rule, company)) return [];
    return [{
      type: 'TRADE',
      side: rule.action,
      quantityMode: 'PERCENT',
      value: rule.percent,
      stockId: rule.stockId,
      source: 'AUTOMATION',
      reason: `${company.name}满足${rule.secondTrigger ? '两项' : '一项'}自动委托条件`,
    }];
  });
}
