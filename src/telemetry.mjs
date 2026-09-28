/** 埋点：记录发生过什么，不改变任何游戏结果。 */
export function createTelemetry() { return { events: [] }; }
export function track(telemetry, type, payload = {}, atDay = 1) {
  return { events: [...telemetry.events, { type, payload, atDay }] };
}
export function summarizeRun(telemetry) {
  const count = type => telemetry.events.filter(event => event.type === type).length;
  return {
    tradeCount: count('TRADE_EXECUTED'),
    autoTradeCount: telemetry.events.filter(event => event.type === 'TRADE_EXECUTED' && event.payload.source === 'AUTOMATION').length,
    guild: telemetry.events.find(event => event.type === 'GUILD_CHOSEN')?.payload.guildId ?? null,
    completed: count('RUN_SETTLED') > 0,
  };
}
