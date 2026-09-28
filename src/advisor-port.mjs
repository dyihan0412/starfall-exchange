/**
 * AI 顾问边界。任何本地规则、LLM 或未来服务都实现这两个方法，
 * 但只能返回“信息”，不能取得 GameState 的写权限。
 */
export class LocalMarketAdvisor {
  brief(snapshot) {
    const companies = Object.values(snapshot.market.companies);
    const target = companies.reduce((best, company) => Math.abs(company.price / company.value - 1) > Math.abs(best.price / best.value - 1) ? company : best);
    const gap = (target.price / target.value - 1) * 100;
    return {
      kind: 'BRIEF',
      title: '市场观察',
      text: `${target.name}目前${gap < 0 ? '低于' : '高于'}合理价值 ${Math.abs(gap).toFixed(0)}%。这是一条解释，不是买卖指令。`,
      evidence: { stockId: target.id, price: target.price, value: target.value },
    };
  }

  eventCandidate(snapshot) {
    const day = snapshot.day;
    if (day % 4 !== 0) return null;
    return { kind: 'EVENT_CANDIDATE', id: 'RUMOR', title: '港口传闻', text: '商会听闻浮空航线可能调整；是否采信仍由玩家决定。' };
  }
}

/** 将来接模型时，实现同样的 brief/eventCandidate 签名即可。 */
export class RemoteAdvisorAdapter {
  constructor({ request }) { this.request = request; }
  async brief(snapshot) { return this.request({ task: 'brief', snapshot }); }
  async eventCandidate(snapshot) { return this.request({ task: 'event-candidate', snapshot }); }
}
