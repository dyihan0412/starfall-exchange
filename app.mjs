import { createCompany, pricesOf } from './src/market.mjs';
import { createRuntime, restoreRuntime, chooseRuntimeGuild, act, advanceRuntimeDay, chooseBlessing, setRules } from './src/game-runtime.mjs';
import { blessings, guilds, buildTier, buildMultiplier, buildRouteSummary, blessingRoute, routeMeta, metaProgressFor } from './src/progression.mjs';
import { createRule } from './src/strategy-engine.mjs';
import { netWorth, positionSummary } from './src/portfolio.mjs';
import {
  createDailyInputs,
} from './src/daily-inputs.mjs';
import { companyBlueprints, events, regimes } from './src/game-config.mjs';

const $ = id => document.getElementById(id);
const PROFILE_KEY = 'starfall-profile-v5';
const RUN_KEY = 'starfall-live-run-v5';
const MODE_KEY = 'starfall-mode';
const DAY_SECONDS = { DEV: 15, NORMAL: 900 };
const categoryNames = { STABLE: '稳健', GROWTH: '成长', SPECULATIVE: '投机' };

const guildCopy = {
  ALCHEMY: ['稳健复利', '重点：月露、星砂银行。靠分红、现金回款和价值回归稳定放大资产。'],
  SAIL: ['趋势扩张', '重点：船坞、铸造厂。顺着上涨加速经营，用卖出与再买入提高周转。'],
  CRYSTAL: ['波动套利', '重点：龙晶、梦境剧院。利用低估、恐慌和大幅波动获得额外收益。'],
};
const knowledgeCopy = {
  VALUE_CRYSTAL: ['估值水晶', '显示合理价值与价格偏离。'],
  TREND_CHART: ['趋势航线图', '显示真实价格历史和涨跌方向。'],
  EVENT_OMEN: ['事件预兆', '在事件前给出模糊方向。'],
};
let run;
let paused = true;
let mode = localStorage.getItem(MODE_KEY) || 'DEV';
let secondsLeft = DAY_SECONDS[mode];
let timer;
let activeFilter = 'ALL';
let lastFeedbackDay = 0;
let lastMilestoneNonce = null;

const companies = () => companyBlueprints.map(data => createCompany(data));
const format = (value, digits = 2) => Number(value ?? 0).toFixed(digits);
const signed = (value, suffix = '') => `${value >= 0 ? '+' : ''}${format(value)}${suffix}`;
const worth = () => netWorth(run.core.portfolio, pricesOf(run.core.market));

function profile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || JSON.parse(localStorage.getItem('starfall-profile-v4')) || JSON.parse(localStorage.getItem('starfall-profile-v3')) || JSON.parse(localStorage.getItem('starfall-profile-v2')) || { cash: 400, renown: 0 }; }
  catch { return { cash: 400, renown: 0 }; }
}

function saveLive() {
  if (!run) return;
  const { advisor, ...serializable } = run;
  localStorage.setItem(RUN_KEY, JSON.stringify({ runtime: serializable, secondsLeft, mode, paused }));
}

function toast(message, strong = false) {
  $('toast').textContent = message;
  $('toast').classList.toggle('strong', strong);
  $('toast').classList.remove('hidden');
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => $('toast').classList.add('hidden'), strong ? 3800 : 2400);
}

function tradeAction(stockId, side) {
  const quantityMode = document.querySelector(`[data-mode="${stockId}"]`).value;
  let value = Number(document.querySelector(`[data-amount="${stockId}"]`).value);
  if (quantityMode === 'PERCENT') value /= 100;
  return { type: 'TRADE', stockId, side, quantityMode, value, source: 'MANUAL' };
}

function miniSparkline(history) {
  const min = Math.min(...history), max = Math.max(...history), span = max - min || 1;
  const points = history.map((price, index) => `${history.length === 1 ? 50 : index / (history.length - 1) * 100},${24 - ((price - min) / span * 20 + 2)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 100 26" preserveAspectRatio="none"><polyline points="${points}"></polyline></svg>`;
}

function renderMarket() {
  const state = run.core;
  const meta = metaProgressFor(run.progression.renown);
  const unlocked = new Set(meta.unlockedStocks);
  const shown = Object.values(state.market.companies).filter(company => activeFilter === 'ALL' || company.category === activeFilter);
  $('mood').textContent = `${state.market.regime} · ${state.market.sectorLead}`;
  $('accessSummary').textContent = `${meta.title} · 已开放 ${meta.unlockedStocks.length}/6 支`;
  $('companies').innerHTML = shown.map(company => {
    const blueprint = companyBlueprints.find(item => item.id === company.id);
    const position = positionSummary(state.portfolio, company.id, company.price);
    const gap = (company.price / company.value - 1) * 100;
    const direction = company.trend > 0 ? 'up' : company.trend < 0 ? 'down' : '';
    const isUnlocked = unlocked.has(company.id);
    const milestone = [{ id: 'bank', renown: 2 }, { id: 'forge', renown: 5 }, { id: 'dream', renown: 8 }].find(item => item.id === company.id);
    return `<article class="company ${direction} ${isUnlocked ? '' : 'locked-stock'}">
      <div class="company-head" data-detail="${company.id}"><div><span class="stock-type ${company.category.toLowerCase()}">${categoryNames[company.category]}</span><h3>${company.name}</h3><p>${blueprint.role}</p></div><div class="quote"><b>${format(company.price)}</b><span class="${direction}">${signed(company.trend * 100, '%')}</span></div></div>
      ${miniSparkline(company.history)}
      <div class="market-read"><span><small>估值偏离</small><b class="${gap <= 0 ? 'up' : 'down'}">${gap <= 0 ? '低估 ' : '溢价 '}${format(Math.abs(gap), 1)}%</b></span><span><small>今日主因</small><b>${company.lastMove.dominant}</b></span></div>
      <p class="driver">${company.lastMove.summary}</p>
      <div class="holding"><strong>${position.shares > 0 ? `${format(position.shares)} 股 · 均价 ${format(position.averageCost)}` : '尚未持有'}</strong><span>市值 ${format(position.marketValue)} · 浮盈 ${signed(position.unrealizedProfit)}</span><em>本轮经营 +${format(run.incomeLedger?.[company.id] ?? 0)}</em></div>
      ${isUnlocked ? `<div class="trade-box"><div class="trade-input"><select data-mode="${company.id}" aria-label="${company.name}交易单位"><option value="PERCENT">比例 %</option><option value="CASH">星铢</option><option value="SHARES">股数</option></select><input data-amount="${company.id}" aria-label="${company.name}交易量" type="number" min="0.01" step="0.01" value="10"></div><button data-buy="${company.id}">买入</button><button class="sell" data-sell="${company.id}">卖出</button></div>` : `<div class="access-lock"><b>市场尚未开放</b><span>商会声望达到 ${milestone?.renown ?? '—'} 后解锁</span></div>`}
    </article>`;
  }).join('');
  document.querySelectorAll('[data-buy]').forEach(button => button.onclick = () => executeTrade(tradeAction(button.dataset.buy, 'BUY')));
  document.querySelectorAll('[data-sell]').forEach(button => button.onclick = () => executeTrade(tradeAction(button.dataset.sell, 'SELL')));
  document.querySelectorAll('[data-detail]').forEach(element => element.onclick = () => showCompany(element.dataset.detail));
}

function executeTrade(action) {
  const beforeShares = run.core.portfolio.holdings[action.stockId] ?? 0;
  run = act(run, action);
  const result = run.core.lastActionResult;
  if (result?.ok) {
    const afterShares = run.core.portfolio.holdings[action.stockId] ?? 0;
    toast(`${action.side === 'BUY' ? '买入' : '卖出'}成功 · 持仓 ${format(beforeShares)} → ${format(afterShares)} 股`);
  } else toast(run.core.log.at(-1)?.message || '交易未执行。');
  render();
}

function renderKnowledge() {
  $('knowledge').innerHTML = Object.entries(knowledgeCopy).map(([id, [name, description]]) => { const unlocked = run.progression.unlockedKnowledge.includes(id); return `<article class="${unlocked ? '' : 'locked'}"><b>${unlocked ? '已解锁' : '声望不足'} · ${name}</b><p>${description}</p></article>`; }).join('');
  $('brief').textContent = run.latestBrief?.text ?? '首日结算后，顾问会解释价格与价值的偏离。';
}

function renderHeadquarters() {
  const meta = metaProgressFor(run.progression.renown);
  const next = meta.next;
  $('headquarters').innerHTML = `<div class="hq-title"><div><p class="eyebrow">PERMANENT PROGRESSION</p><h3>${meta.title}</h3></div><b>${run.progression.renown} 声望</b></div><div class="hq-grid"><span><small>市场权限</small><b>${meta.unlockedStocks.length}/6 支</b></span><span><small>自动委托</small><b>${meta.ruleSlots} 槽位</b></span><span><small>组合条件</small><b>${meta.compoundConditions ? '已开放' : '未开放'}</b></span><span><small>经营倍率</small><b>×${format(meta.incomeMultiplier, 1)}</b></span></div>${next ? `<div class="next-unlock"><b>下一目标：${next.renown} 声望</b><span>${next.unlock}</span><i style="width:${Math.min(100, run.progression.renown / next.renown * 100)}%"></i></div>` : '<div class="next-unlock"><b>总署已满级</b><span>全部市场和自动化能力均已开放。</span><i style="width:100%"></i></div>'}`;
}

function effectText(id) {
  const effect = run.effectLedger[id];
  if (id === 'SAIL_TURNOVER' && run.runEffects.quickTurnoverReady) return '已就绪：下一次买入会获得额外股份。';
  if (!effect) return '已生效，等待下一个结算条件。';
  const cash = effect.cashGained > 0 ? ` · 累计 +${format(effect.cashGained)} 星铢` : '';
  return `触发 ${effect.triggers} 次${cash} · ${effect.detail}`;
}

function renderBuild() {
  const guild = guilds[run.progression.run.guildId];
  const owned = run.progression.run.blessings;
  const tier = buildTier(owned.length);
  const nextAt = [2, 3, 4].find(value => value > owned.length) ?? 4;
  const bonus = Math.round((buildMultiplier(owned.length) - 1) * 100);
  $('guildName').textContent = guild?.name ?? '未选择商会';
  $('guildPlaystyle').textContent = guildCopy[guild?.id]?.[1] ?? '先选择商会。';
  $('synergy').innerHTML = guild ? `<div><b>构筑 ${tier} 阶</b><span>全部词条效果 +${bonus}%</span></div><div class="tier-track"><i style="width:${Math.min(100, owned.length / 4 * 100)}%"></i></div><small>${owned.length >= 4 ? '本局四项构筑已成型' : `再获得 ${nextAt - owned.length} 个词条升阶`}</small>` : '';
  $('routes').innerHTML = guild ? buildRouteSummary(owned).map(route => `<article class="route ${route.active ? 'active' : ''}"><span>${routeMeta[route.id].name}</span><b>${route.count}/2</b><small>${route.active ? `路线联动：该类效果 ×${format(route.multiplier, 2)}` : routeMeta[route.id].description}</small></article>`).join('') : '';
  $('build').innerHTML = owned.length ? owned.map(id => `<article class="blessing-card"><div class="card-title"><p class="eyebrow">${blessings[id].name}</p><span>${routeMeta[blessingRoute(blessings[id])].name}</span></div><p>${blessings[id].description}</p><div class="effect ${run.effectLedger[id] ? '' : 'dormant'}">${effectText(id)}</div></article>`).join('') : '<div class="empty-state"><h3>第 1 日先确定方向</h3><p>同一路线集齐 2 项会让该类效果再提高 15%；四次选择可以专精，也可以混合。</p></div>';
}

function renderRules() {
  const meta = metaProgressFor(run.progression.renown);
  const conditionOptions = (selected, allowEmpty = false) => `${allowEmpty ? `<option value="" ${!selected ? 'selected' : ''}>不使用第二条件</option>` : ''}<option value="BELOW_VALUE" ${selected === 'BELOW_VALUE' ? 'selected' : ''}>低于价值</option><option value="ABOVE_VALUE" ${selected === 'ABOVE_VALUE' ? 'selected' : ''}>高于价值</option><option value="TREND_UP" ${selected === 'TREND_UP' ? 'selected' : ''}>正在上涨</option><option value="TREND_DOWN" ${selected === 'TREND_DOWN' ? 'selected' : ''}>正在下跌</option>`;
  $('ruleCapacity').textContent = `${run.rules.length}/${meta.ruleSlots} 槽位${meta.compoundConditions ? ' · 已解锁组合条件' : ' · 声望 5 解锁组合条件'}`;
  $('rules').innerHTML = run.rules.length ? run.rules.map((rule, index) => `<article class="rule ${meta.compoundConditions ? 'compound' : ''}" data-rule="${index}"><label>股票<select data-field="stockId">${companyBlueprints.filter(company => meta.unlockedStocks.includes(company.id)).map(company => `<option value="${company.id}" ${rule.stockId === company.id ? 'selected' : ''}>${company.name}</option>`).join('')}</select></label><label>条件一<select data-field="trigger">${conditionOptions(rule.trigger)}</select></label><label>阈值 %<input data-field="threshold" type="number" min="0" value="${rule.threshold * 100}"></label>${meta.compoundConditions ? `<label>并且<select data-field="secondTrigger">${conditionOptions(rule.secondTrigger, true)}</select></label><label>阈值 %<input data-field="secondThreshold" type="number" min="0" value="${(rule.secondThreshold ?? 0) * 100}"></label>` : ''}<label>执行<select data-field="action"><option value="BUY" ${rule.action === 'BUY' ? 'selected' : ''}>买入</option><option value="SELL" ${rule.action === 'SELL' ? 'selected' : ''}>卖出</option></select></label><label>使用 %<input data-field="percent" type="number" min="1" max="100" value="${rule.percent * 100}"></label><button class="remove" data-remove="${index}">移除</button></article>`).join('') : '<div class="empty-state"><h3>先建立第一条挂机规则</h3><p>市场每天自动检查。声望会逐步解锁更多槽位和组合条件。</p></div>';
  document.querySelectorAll('[data-rule]').forEach(row => row.querySelectorAll('[data-field]').forEach(input => input.onchange = updateRulesFromUi));
  document.querySelectorAll('[data-remove]').forEach(button => button.onclick = () => { run = setRules(run, run.rules.filter((_, index) => index !== Number(button.dataset.remove))); render(); });
}

function updateRulesFromUi() {
  const rules = [...document.querySelectorAll('[data-rule]')].map(row => { const field = name => row.querySelector(`[data-field="${name}"]`)?.value ?? ''; return createRule({ stockId: field('stockId'), trigger: field('trigger'), threshold: Number(field('threshold')) / 100, secondTrigger: field('secondTrigger') || null, secondThreshold: Number(field('secondThreshold')) / 100, action: field('action'), percent: Number(field('percent')) / 100 }); });
  run = setRules(run, rules); saveLive();
}

function renderLedger() {
  const transactions = [...run.core.portfolio.transactions].reverse();
  $('log').innerHTML = transactions.length ? transactions.map(transaction => { const company = run.core.market.companies[transaction.stockId]; const label = transaction.type === 'BUY' ? '买入' : transaction.type === 'SELL' ? '卖出' : transaction.note; const detail = transaction.type === 'CREDIT' ? `收益到账` : `${company?.name ?? transaction.stockId} · ${format(transaction.shares)} 股 @ ${format(transaction.price)}`; return `<div class="entry"><time>第 ${transaction.day ?? run.core.day} 日</time><span><b>${label}</b><small>${detail}${transaction.bonusShares > 0 ? ` · 额外 +${format(transaction.bonusShares)} 股` : ''}</small></span><span class="amount">${format(transaction.cashAmount)} 星铢</span></div>`; }).join('') : '<div class="empty-state"><h3>还没有记录</h3><p>交易、词条收益和最终清仓都会出现在这里。</p></div>';
}

function renderMailbox() {
  const owned = run.progression.run.blessings;
  const unread = run.mailbox.filter(mail => !mail.claimed && mail.offerIds.some(id => !owned.includes(id))).length;
  $('mailBadge').textContent = unread;
  $('mailbox').innerHTML = [...run.mailbox].reverse().map(mail => `<article class="mail ${mail.claimed ? 'claimed' : ''}"><div class="mail-head"><b>第 ${mail.day} 日</b><span>${mail.claimed ? `已选「${blessings[mail.selectedBlessingId]?.name}」` : '选择 1 张'}</span></div><div class="offer-grid">${mail.offerIds.map(id => { const ownedAlready = owned.includes(id); return `<button class="offer ${ownedAlready ? 'owned' : ''}" data-offer="${id}" data-mail="${mail.id}" ${mail.claimed || ownedAlready ? 'disabled' : ''}><strong>${blessings[id].name}${ownedAlready ? ' · 已拥有' : ''}</strong><small>${blessings[id].description}</small></button>`; }).join('')}</div></article>`).join('') || '<div class="empty-state">选择商会后，第一封信立即送达。</div>';
  document.querySelectorAll('[data-offer]').forEach(button => button.onclick = () => { const result = chooseBlessing(run, button.dataset.offer, button.dataset.mail); if (result.ok) run = result.runtime; toast(result.reason, Boolean(result.ok && run.lastMilestone?.nonce !== lastMilestoneNonce)); render(); renderMailbox(); });
}

function renderFeedback() {
  const currentWorth = worth();
  const growth = run.startCash ? (currentWorth / run.startCash - 1) : 0;
  $('runReturn').textContent = signed(growth * 100, '%');
  $('runReturn').className = growth >= 0 ? 'up' : 'down';
  $('growthBar').style.width = `${Math.min(100, Math.max(2, 50 + growth * 200))}%`;
  const summary = run.lastDaySummary;
  $('daySummary').innerHTML = summary ? `<div><small>资产变化</small><b class="${summary.change >= 0 ? 'up' : 'down'}">${signed(summary.change)} 星铢</b></div><div><small>持仓经营</small><b class="up">+${format(summary.operatingIncome)}</b></div><div><small>词条收益</small><b>+${format(Math.max(0, summary.cashIncome - summary.operatingIncome))}</b></div><div><small>市场主线</small><b>${run.core.market.sectorLead}</b></div><div><small>最大波动</small><b>${summary.topMover.name} ${signed(summary.topMover.trend * 100, '%')}</b></div>` : '<p>市场尚未结算。买入股票后，公司会在每个市场日自动产生经营回款。</p>';
  if (summary && summary.day > lastFeedbackDay) {
    lastFeedbackDay = summary.day;
    const burst = $('gainBurst');
    burst.textContent = `${summary.change >= 0 ? '资产增长' : '资产回撤'} ${signed(summary.change)} 星铢`;
    burst.className = `gain-burst ${summary.change >= 0 ? 'positive' : 'negative'}`;
    setTimeout(() => burst.classList.add('hidden'), 2200);
    $('net').classList.add('pulse'); setTimeout(() => $('net').classList.remove('pulse'), 700);
  }
  if (run.lastMilestone && run.lastMilestone.nonce !== lastMilestoneNonce) {
      lastMilestoneNonce = run.lastMilestone.nonce;
    $('milestone').innerHTML = `<b>构筑升到 ${run.lastMilestone.tier} 阶</b><span>全部词条效果提升至 +${Math.round((run.lastMilestone.multiplier - 1) * 100)}%</span>`;
    $('milestone').classList.remove('hidden');
    setTimeout(() => $('milestone').classList.add('hidden'), 3600);
  }
}

function render() {
  const state = run.core;
  $('day').textContent = `${Math.min(state.day, 12)} / 12`;
  $('timer').textContent = state.phase === 'REPORT' ? '本轮完成' : `下一日 ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
  $('cash').textContent = format(state.portfolio.cash);
  $('net').textContent = format(worth());
  $('renown').textContent = run.progression.renown;
  const guild = guilds[run.progression.run.guildId];
  $('status').textContent = guild ? `${guild.name} · ${run.progression.run.blessings.length}/4 词条` : state.phase === 'REPORT' ? '轮回已结算' : '等待选择商会';
  $('pause').textContent = paused ? '继续市场' : '暂停市场';
  $('speedMode').value = mode;
  renderMarket(); renderKnowledge(); renderHeadquarters(); renderBuild(); renderRules(); renderLedger(); renderMailbox(); renderFeedback();
  if (state.phase === 'REPORT' && run.settlement) showReport();
  saveLive();
}

function showCompany(stockId) {
  const company = run.core.market.companies[stockId];
  const blueprint = companyBlueprints.find(item => item.id === stockId);
  const drivers = company.lastMove.drivers;
  $('detail').innerHTML = `<p class="eyebrow">PRICE EXPLAINER</p><h2>${company.name}</h2><p class="lead">${blueprint.clue}</p>${miniSparkline(company.history)}<div class="detailgrid"><article>市场价格<b>${format(company.price)}</b></article><article>合理价值<b>${format(company.value)}</b></article><article>当日涨跌<b class="${company.trend >= 0 ? 'up' : 'down'}">${signed(company.trend * 100, '%')}</b></article><article>涨跌限制<b>±${format(company.priceLimit * 100, 0)}%</b></article></div><h3 class="detail-title">本日价格力量</h3><div class="driver-list"><span>价值回归 <b>${signed(drivers.value, '%')}</b></span><span>趋势资金 <b>${signed(drivers.trend, '%')}</b></span><span>市场情绪 <b>${signed(drivers.sentiment, '%')}</b></span><span>公司事件 <b>${signed(drivers.event, '%')}</b></span><span>大盘环境 <b>${signed(drivers.macro, '%')}</b></span><span>板块轮动 <b>${signed(drivers.sector, '%')}</b></span><span>流动性 <b>${signed(drivers.liquidity, '%')}</b></span><span>主导力量 <b>${company.lastMove.dominant}</b></span></div>`;
  $('detailModal').classList.remove('hidden');
}

function showReport() {
  paused = true;
  const growth = run.settlement.worth / run.startCash - 1;
  const operatingTotal = Object.values(run.incomeLedger ?? {}).reduce((sum, amount) => sum + amount, 0);
  const nextMeta = metaProgressFor(run.progression.renown);
  $('report').innerHTML = `<div class="report-hero"><span>本轮资产</span><b>${format(run.settlement.worth)}</b><em class="${growth >= 0 ? 'up' : 'down'}">${signed(growth * 100, '%')}</em></div><div class="reportgrid"><article>经营回款<b>+${format(operatingTotal)}</b></article><article>声望增长<b>+${run.settlement.gain}</b></article><article>自动执行<b>${run.telemetry.events.filter(event => event.type === 'TRADE_EXECUTED' && event.payload?.source === 'AUTOMATION').length}</b></article><article>总署身份<b>${nextMeta.title}</b></article></div><p>持仓已自动清仓。现金、声望和自动化权限进入下一轮。</p>`;
  $('reportModal').classList.remove('hidden');
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ cash: run.settlement.worth, renown: run.progression.renown, knowledge: run.progression.unlockedKnowledge }));
}

function showGuildPicker() {
  paused = true;
  $('guilds').innerHTML = Object.entries(guilds).map(([id, guild]) => `<button class="guild" data-guild="${id}"><span>${guildCopy[id][0]}</span><strong>${guild.name}</strong><small>${guildCopy[id][1]}</small><em>核心股票：${guild.stocks.map(stock => companyBlueprints.find(item => item.id === stock).name).join('、')}</em></button>`).join('');
  $('guildModal').classList.remove('hidden');
  document.querySelectorAll('[data-guild]').forEach(button => button.onclick = () => { run = chooseRuntimeGuild(run, button.dataset.guild).runtime; $('guildModal').classList.add('hidden'); paused = false; secondsLeft = DAY_SECONDS[mode]; render(); });
}

function newRun() {
  const savedProfile = profile();
  run = createRuntime({ companies: companies(), cash: savedProfile.cash, renown: savedProfile.renown, knowledge: savedProfile.knowledge });
  secondsLeft = DAY_SECONDS[mode]; lastFeedbackDay = 0; lastMilestoneNonce = null;
  localStorage.removeItem(RUN_KEY); $('reportModal').classList.add('hidden'); showGuildPicker(); render();
}

function dailyInputs(random = Math.random) {
  return createDailyInputs({
    companies: companyBlueprints,
    regimes,
    events,
    random,
  });
}

function advanceOneDay() { run = advanceRuntimeDay(run, dailyInputs()); secondsLeft = DAY_SECONDS[mode]; render(); }

function boot() {
  try { const saved = JSON.parse(localStorage.getItem(RUN_KEY)); if (saved?.runtime) { run = restoreRuntime(saved.runtime); secondsLeft = saved.secondsLeft ?? DAY_SECONDS[mode]; mode = saved.mode ?? mode; paused = saved.paused ?? true; lastFeedbackDay = run.lastDaySummary?.day ?? 0; lastMilestoneNonce = run.lastMilestone?.nonce ?? null; } }
  catch { localStorage.removeItem(RUN_KEY); }
  if (!run) return newRun();
  if (!run.progression.run.guildId && run.core.phase === 'PLAYING') showGuildPicker();
  render();
}

document.querySelectorAll('.tab').forEach(button => button.onclick = () => { document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab === button)); document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('hidden', panel.id !== button.dataset.tab)); });
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => $(button.dataset.close).classList.add('hidden'));
document.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => { activeFilter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('active', item === button)); renderMarket(); });
$('openMailbox').onclick = () => { renderMailbox(); $('mailModal').classList.remove('hidden'); };
$('pause').onclick = () => { if (run.core.phase === 'PLAYING' && run.progression.run.guildId) paused = !paused; render(); };
$('reset').onclick = newRun; $('nextRun').onclick = newRun;
$('speedMode').onchange = event => { mode = event.target.value; localStorage.setItem(MODE_KEY, mode); secondsLeft = DAY_SECONDS[mode]; render(); };
$('addRule').onclick = () => { const meta = metaProgressFor(run.progression.renown); if (run.rules.length >= meta.ruleSlots) return toast(`当前只有 ${meta.ruleSlots} 个自动委托槽位。`); run = setRules(run, [...run.rules, createRule({ stockId: 'moon', trigger: 'BELOW_VALUE', threshold: .1, action: 'BUY', percent: .1 })]); render(); };

boot();
clearInterval(timer);
timer = setInterval(() => { if (!run || paused || run.core.phase !== 'PLAYING') return; secondsLeft -= 1; if (secondsLeft <= 0) advanceOneDay(); else { $('timer').textContent = `下一日 ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`; saveLive(); } }, 1000);
