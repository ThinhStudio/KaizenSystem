// Offline-first outbox: kaizen proposals (with photos) are stored in IndexedDB
// when the factory Wi-Fi is down, then synced automatically. client_uuid makes sync idempotent.
import { api } from './api.js';

const DB = 'kaizen-offline', STORE = 'outbox';

function db() {
  return new Promise((ok, fail) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'client_uuid' });
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((ok, fail) => {
    const t = d.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => ok(r && r.result);
    t.onerror = () => fail(t.error);
  });
}

export const queue = (item) => tx('readwrite', (s) => s.put(item));
export const pending = () => tx('readonly', (s) => s.getAll());
const remove = (id) => tx('readwrite', (s) => s.delete(id));

export function toForm(item) {
  const f = new FormData();
  for (const [k, v] of Object.entries(item.fields)) if (v !== undefined && v !== null && v !== '') f.append(k, v);
  f.append('client_uuid', item.client_uuid);
  for (const file of item.files || []) f.append('before', file, file.name);
  return f;
}

let syncing = false;
export async function sync(onDone) {
  if (syncing || !navigator.onLine) return 0;
  syncing = true;
  let n = 0;
  try {
    for (const item of await pending()) {
      try {
        await api('/kaizens', { method: 'POST', form: toForm(item) });
        await remove(item.client_uuid);
        n++;
      } catch (e) {
        if (e.status && e.status < 500) await remove(item.client_uuid); // permanently invalid
        else break; // network/server issue: retry later
      }
    }
  } finally { syncing = false; }
  if (n && onDone) onDone(n);
  return n;
}
