export const session = {
  get token() { return localStorage.getItem('kz_token'); },
  get user() { try { return JSON.parse(localStorage.getItem('kz_user')); } catch { return null; } },
  set(token, user) { localStorage.setItem('kz_token', token); localStorage.setItem('kz_user', JSON.stringify(user)); },
  clear() { localStorage.removeItem('kz_token'); localStorage.removeItem('kz_user'); },
};

export class ApiError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

export async function api(path, { method = 'GET', body, form } = {}) {
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

export const fileUrl = (id) => `/api/v1/attachments/${id}/file?token=${encodeURIComponent(session.token)}`;
