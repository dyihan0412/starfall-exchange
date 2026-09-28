import assert from 'node:assert/strict';
import { serialize, deserialize, createLocalStorageRepository } from '../src/persistence.mjs';
import { createTelemetry, track, summarizeRun } from '../src/telemetry.mjs';

const state = { day: 3, portfolio: { cash: 360 } };
assert.deepEqual(deserialize(serialize(state)).state, state);
assert.equal(deserialize('{bad json').ok, false);
const data = new Map();
const repository = createLocalStorageRepository({ setItem: (k,v) => data.set(k,v), getItem: k => data.get(k) ?? null, removeItem: k => data.delete(k) });
repository.save(state); assert.equal(repository.load().state.day, 3); repository.clear(); assert.equal(repository.load().ok, false);

let telemetry = createTelemetry();
telemetry = track(telemetry, 'GUILD_CHOSEN', { guildId: 'ALCHEMY' });
telemetry = track(telemetry, 'TRADE_EXECUTED', { source: 'MANUAL' }, 2);
telemetry = track(telemetry, 'TRADE_EXECUTED', { source: 'AUTOMATION' }, 3);
telemetry = track(telemetry, 'RUN_SETTLED');
assert.deepEqual(summarizeRun(telemetry), { tradeCount: 2, autoTradeCount: 1, guild: 'ALCHEMY', completed: true });
console.log('persistence and telemetry tests: passed');
