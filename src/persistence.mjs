/** 存档：显式携带版本号，避免未来字段变化导致旧存档崩溃。 */
export const SAVE_VERSION = 1;

export function serialize(state) {
  return JSON.stringify({ version: SAVE_VERSION, savedAt: new Date(0).toISOString(), state });
}

export function deserialize(text) {
  try {
    const save = JSON.parse(text);
    if (save.version !== SAVE_VERSION || !save.state) return { ok: false, reason: '存档版本不兼容' };
    return { ok: true, state: save.state };
  } catch { return { ok: false, reason: '存档内容损坏' }; }
}

export function createLocalStorageRepository(storage, key = 'starfall-exchange-save') {
  return {
    save: state => storage.setItem(key, serialize(state)),
    load: () => { const raw = storage.getItem(key); return raw ? deserialize(raw) : { ok: false, reason: '没有存档' }; },
    clear: () => storage.removeItem(key),
  };
}
