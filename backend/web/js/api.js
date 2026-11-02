import { mockApi, mockFileUrl } from './mock.js';

export const DEMO = !!window.KAIZEN_DEMO;

// Storage can throw (private mode, sandboxed frames): fall back to memory.
const mem = {};
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return mem[k] ?? null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { mem[k] = v; } },
  del: (k) => { try { localStorage.removeItem(k); } catch { delete mem[k]; } },
};

export const session = {
  get token() { return store.get('kz_token'); },
  get user() { try { return JSON.parse(store.get('kz_user')); } catch { return null; } },
  set(token, user) { store.set('kz_token', token); store.set('kz_user', JSON.stringify(user)); },
  clear() { store.del('kz_token'); store.del('kz_user'); },
};

export class ApiError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  if (DEMO) {
    try { return await mockApi(path, { method, body, form }, session.token); }
    catch (e) {
      if (e.status === 401 && path !== '/auth/login') { session.clear(); location.hash = '#/login'; }
      throw new ApiError(e.status || 500, e.message);
    }
  }
  const headers = {};
  if (session.token) headers.Authorization = 'Bearer ' + session.token;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch('/api/v1' + path, { method, headers, body: payload });
  if (res.status === 401 && path !== '/auth/login') { session.clear(); location.hash = '#/login'; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || res.statusText);
  return data;
}

export const fileUrl = (id) => (DEMO ? mockFileUrl(id) : `/api/v1/attachments/${id}/file?token=${encodeURIComponent(session.token)}`);
