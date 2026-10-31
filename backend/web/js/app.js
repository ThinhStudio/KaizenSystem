import { api, session, fileUrl } from './api.js';
import { queue, pending, sync, toForm } from './offline.js';

const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (v) => new Intl.NumberFormat('vi-VN').format(Math.round(v || 0)) + ' ₫';
const dt = (v) => (v ? new Date(v).toLocaleString('vi-VN') : '');
const role = () => session.user?.role;

const STATUS = {
  DRAFT: 'Nháp', PENDING_LEADER: 'Chờ Tổ trưởng', REVISION_REQUESTED: 'Cần chỉnh sửa', REJECTED: 'Từ chối',
  QUICK_WIN: 'Quick Win - đang làm', PENDING_IE: 'Chờ Ban Kaizen/IE', IMPLEMENTING: 'Đang triển khai',
  PENDING_FINANCE: 'Chờ Kế toán thẩm định', COMPLETED: 'Hoàn thành', OFFLINE: 'Chờ đồng bộ',
};
const badge = (s) => `<span class="badge s-${esc(s)}">${esc(STATUS[s] || s)}</span>`;

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3500);
}

function updateNet() {
  const n = $('#net');
  n.textContent = navigator.onLine ? 'Online' : 'Offline';
  n.classList.toggle('off', !navigator.onLine);
}
window.addEventListener('online', () => { updateNet(); sync((k) => toast(`Đã đồng bộ ${k} sáng kiến`)); });
window.addEventListener('offline', updateNet);

// ---------------- views ----------------
const routes = {
  login: viewLogin, '': viewList, new: viewNew, kaizen: viewDetail, approvals: viewApprovals, dashboard: viewDashboard,
};

async function render() {
  const [path, query] = location.hash.slice(2).split('?');
  const [name, id] = path.split('/');
  const params = new URLSearchParams(query || '');
  if (!session.token && name !== 'login') {
    if (params.get('line')) sessionStorage.setItem('kz_line', params.get('line'));
    location.hash = '#/login'; return;
  }
  $('#nav').hidden = !session.token; $('#logout').hidden = !session.token;
  document.querySelectorAll('#nav a').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('href') === '#/' + (name || ''));
    if (a.dataset.roles) a.hidden = !a.dataset.roles.split(',').includes(role());
  });
  try { await (routes[name] || viewList)(id, params); }
  catch (e) { app.innerHTML = `<div class="card">Lỗi: ${esc(e.message)}</div>`; }
}
window.addEventListener('hashchange', render);
$('#logout').onclick = () => { session.clear(); location.hash = '#/login'; };

function viewLogin() {
  app.innerHTML = `<div class="card" style="max-width:420px;margin:40px auto">
    <h2>Đăng nhập</h2>
    <form id="f"><label>Mã nhân viên</label><input name="employee_code" required autocomplete="username">
    <label>Mật khẩu</label><input name="password" type="password" required autocomplete="current-password">
    <p><button>Đăng nhập</button></p></form></div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try {
      const r = await api('/auth/login', { method: 'POST', body: fd });
      session.set(r.token, r.user);
      const line = sessionStorage.getItem('kz_line'); sessionStorage.removeItem('kz_line');
      location.hash = line ? `#/new?line=${line}` : '#/';
    } catch (err) { toast(err.message); }
  };
}

async function viewList(_, params) {
  const status = params.get('status') || '';
  app.innerHTML = `<div class="row"><h2 class="grow">Sáng kiến cải tiến</h2>
    <select id="st" style="width:auto"><option value="">Tất cả trạng thái</option>
    ${Object.entries(STATUS).filter(([k]) => k !== 'OFFLINE').map(([k, v]) => `<option value="${k}" ${k === status ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div id="out"></div><div id="items">Đang tải…</div>`;
  $('#st').onchange = (e) => (location.hash = '#/?status=' + e.target.value);

  const outbox = await pending().catch(() => []);
  if (outbox.length) {
    $('#out').innerHTML = `<div class="card"><b>${outbox.length}</b> sáng kiến đang chờ đồng bộ (offline). ${outbox.map((o) => `<div class="meta">${esc(o.fields.title)} ${badge('OFFLINE')}</div>`).join('')}</div>`;
  }
  const res = await api('/kaizens?page_size=50' + (status ? '&status=' + status : ''));
  $('#items').innerHTML = res.items.length ? res.items.map((k) => `
    <a class="card list-item" href="#/kaizen/${k.id}">
      ${k.thumb_id ? `<img class="thumb" loading="lazy" src="${fileUrl(k.thumb_id)}" alt="">` : '<div class="thumb"></div>'}
      <div class="grow"><div><b>${esc(k.title)}</b></div>
      <div class="meta">${esc(k.code)} · ${esc(k.category)} · ${esc(k.workshop)}${k.line ? ' / ' + esc(k.line) : ''} · ${esc(k.submitter)}</div>
      <div class="row" style="margin-top:4px">${badge(k.status)}${k.kaizen_type ? `<span class="badge">${esc(k.kaizen_type)}</span>` : ''}
      <span class="meta">${dt(k.created_at)}</span></div></div></a>`).join('')
    : '<div class="card">Chưa có sáng kiến nào. <a href="#/new">Gửi đề xuất đầu tiên</a></div>';
}

async function viewNew(_, params) {
  const [cats, master] = await Promise.all([api('/categories'), api('/master')]);
  let qrLine = null;
  if (params.get('line')) qrLine = await api('/lines/qr/' + encodeURIComponent(params.get('line'))).catch(() => null);
  const u = session.user;
  const lines = master.lines.filter((l) => !u.wid || l.workshop_id === u.wid);
  app.innerHTML = `<div class="card"><h2>Đề xuất sáng kiến mới</h2>
    ${qrLine ? `<p class="meta">📍 ${esc(qrLine.workshop_name)} / <b>${esc(qrLine.name)}</b> (quét QR)</p>` : ''}
    <form id="f">
      <label>Tiêu đề *</label><input name="title" required maxlength="255">
      <label>Lĩnh vực *</label><select name="category_id" required>${cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
      ${qrLine ? `<input type="hidden" name="line_qr" value="${esc(params.get('line'))}">` : `
      <label>Dây chuyền</label><select name="line_id"><option value="">(theo hồ sơ của tôi)</option>
      ${lines.map((l) => `<option value="${l.id}">${esc(l.code)} - ${esc(l.name)}</option>`).join('')}</select>`}
      <label>Hiện trạng / Vấn đề (Before) *</label><textarea name="problem" required></textarea>
      <label>Giải pháp đề xuất *</label><textarea name="proposal" required></textarea>
      <label>Lợi ích mong đợi</label><textarea name="expected_benefit"></textarea>
      <label>Ước tính tiết kiệm / năm (VNĐ)</label><input name="estimated_saving" type="number" min="0" step="1000" value="0">
      <label>Ảnh / video hiện trường (Before)</label>
      <input name="before" type="file" accept="image/*,video/*" capture="environment" multiple>
      <p class="row"><button name="act" value="submit">Gửi duyệt</button><button class="sec" name="act" value="draft">Lưu nháp</button></p>
    </form></div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target, fd = new FormData(form);
    const fields = {};
    for (const [k, v] of fd.entries()) if (k !== 'before') fields[k] = v;
    fields.submit = String(e.submitter?.value !== 'draft');
    const item = { client_uuid: crypto.randomUUID(), fields, files: [...form.before.files] };
    form.querySelectorAll('button').forEach((b) => (b.disabled = true));
    if (!navigator.onLine) { await queue(item); toast('Đang offline – đã lưu, sẽ tự đồng bộ khi có mạng'); location.hash = '#/'; return; }
    try {
      const r = await api('/kaizens', { method: 'POST', form: toForm(item) });
      toast(`Đã tạo ${r.code}`); location.hash = '#/kaizen/' + r.id;
    } catch (err) {
      if (!err.status || err.status >= 500) { await queue(item); toast('Mất kết nối – đã lưu offline'); location.hash = '#/'; }
      else { toast(err.message); form.querySelectorAll('button').forEach((b) => (b.disabled = false)); }
    }
  };
}

async function viewDetail(id) {
  const k = await api('/kaizens/' + id);
  const u = session.user, r = role();
  const isOwner = k.assignee_id === u.uid, isSubmitter = k.submitter_id === u.uid;
  const imgs = (phase) => k.attachments.filter((a) => a.phase === phase).map((a) =>
    a.content_type.startsWith('image/') ? `<a href="${fileUrl(a.id)}" target="_blank"><img loading="lazy" src="${fileUrl(a.id)}" alt="${esc(a.file_name)}"></a>`
      : `<a href="${fileUrl(a.id)}" target="_blank">${esc(a.file_name)}</a>`).join('') || '<span class="meta">Chưa có</span>';
  const canTasks = isOwner || ['IE', 'ADMIN', 'LEADER'].includes(r);
  const working = ['QUICK_WIN', 'IMPLEMENTING'].includes(k.status);
  const canComplete = (k.status === 'QUICK_WIN' && (isOwner || ['LEADER', 'ADMIN'].includes(r)))
    || (k.status === 'IMPLEMENTING' && (isOwner || ['IE', 'ADMIN'].includes(r)));
  const f = k.financials;

  app.innerHTML = `<div class="card">
    <div class="row"><h2 class="grow">${esc(k.title)}</h2>${badge(k.status)}${k.kaizen_type ? `<span class="badge">${esc(k.kaizen_type)}</span>` : ''}</div>
    <div class="meta">${esc(k.code)} · ${esc(k.category)} · ${esc(k.workshop)}${k.line ? ' / ' + esc(k.line) : ''} · Người đề xuất: ${esc(k.submitter)}${k.assignee ? ' · Phụ trách: ' + esc(k.assignee) : ''}</div>
    <h3>Hiện trạng</h3><p>${esc(k.problem)}</p><h3>Giải pháp</h3><p>${esc(k.proposal)}</p>
    ${k.expected_benefit ? `<h3>Lợi ích</h3><p>${esc(k.expected_benefit)}</p>` : ''}
    <p class="meta">Ước tính tiết kiệm: <b>${money(k.estimated_saving)}</b>/năm</p>
    ${['DRAFT', 'REVISION_REQUESTED'].includes(k.status) && isSubmitter ? '<button id="submit">Gửi duyệt</button>' : ''}
  </div>
  <div class="card"><h3>Before</h3><div class="gallery">${imgs('BEFORE')}</div>
    <h3>After</h3><div class="gallery">${imgs('AFTER')}</div>
    ${working ? `<form id="up" class="row" style="margin-top:8px"><input type="file" name="files" accept="image/*,video/*" capture="environment" multiple class="grow" required><button>Tải ảnh After</button></form>` : ''}
    ${canComplete ? `<p><button id="complete">${k.status === 'QUICK_WIN' ? '✔ Hoàn thành Quick Win' : '✔ Hoàn thành – chuyển Kế toán thẩm định'}</button></p>` : ''}
  </div>
  ${k.kaizen_type === 'MAJOR' ? `<div class="card"><h3>Kanban triển khai</h3>
    <div class="kanban">${['TODO', 'IN_PROGRESS', 'DONE'].map((s) => `<div class="col"><h4>${s}</h4>${k.tasks.filter((t) => t.status === s).map((t) => `
      <div class="task"><b>${esc(t.title)}</b>${t.assignee ? `<div class="meta">${esc(t.assignee)}</div>` : ''}${t.due_date ? `<div class="meta">Hạn: ${esc(t.due_date.slice(0, 10))}</div>` : ''}
      ${working && canTasks ? `<div>${s !== 'TODO' ? `<button class="sec" data-t="${t.id}" data-s="${s === 'DONE' ? 'IN_PROGRESS' : 'TODO'}">◀</button>` : ''}
      ${s !== 'DONE' ? `<button data-t="${t.id}" data-s="${s === 'TODO' ? 'IN_PROGRESS' : 'DONE'}">▶</button>` : ''}</div>` : ''}</div>`).join('')}</div>`).join('')}</div>
    ${canTasks && ['IMPLEMENTING', 'PENDING_IE'].includes(k.status) ? `<form id="task" class="row" style="margin-top:8px"><input name="title" placeholder="Công việc mới" required class="grow" style="width:auto"><input name="due_date" type="date" style="width:auto"><button>Thêm</button></form>` : ''}
  </div>` : ''}
  ${f || ['IE', 'FINANCE', 'ADMIN'].includes(r) && k.kaizen_type === 'MAJOR' ? `<div class="card"><h3>Tài chính / ROI</h3>
    ${f ? `<table><tr><td>Chi phí đầu tư</td><td class="num">${money(f.investment_cost)}</td></tr>
      <tr><td>Tiết kiệm / năm</td><td class="num">${money(f.annual_saving)}</td></tr>
      <tr><td>ROI</td><td class="num">${f.roi_percent != null ? f.roi_percent + ' %' : '—'}</td></tr>
      <tr><td>Hoàn vốn</td><td class="num">${f.payback_months != null ? f.payback_months + ' tháng' : '—'}</td></tr>
      <tr><td>Kế toán xác thực</td><td class="num">${f.verified ? '✔ ' + dt(f.verified_at) : 'Chưa'}</td></tr></table>` : '<p class="meta">Chưa có số liệu</p>'}
    ${['IE', 'FINANCE', 'ADMIN'].includes(r) && !['COMPLETED', 'REJECTED'].includes(k.status) ? `<form id="fin" class="row" style="margin-top:8px">
      <input name="investment_cost" type="number" min="0" placeholder="Chi phí đầu tư" class="grow" style="width:auto" value="${f?.investment_cost ?? ''}">
      <input name="annual_saving" type="number" min="0" placeholder="Tiết kiệm/năm" class="grow" style="width:auto" value="${f?.annual_saving ?? ''}"><button>Lưu</button></form>` : ''}
  </div>` : ''}
  <div class="card"><h3>Lịch sử phê duyệt</h3><ul class="timeline">${k.approvals.map((a) => `<li><b>${esc(a.level)}</b> – ${esc(a.status)}
    ${a.acted_by ? ' bởi ' + esc(a.acted_by) : ''} <span class="meta">${dt(a.acted_at || a.created_at)}</span>${a.comment ? `<div>“${esc(a.comment)}”</div>` : ''}</li>`).join('') || '<li class="meta">Chưa gửi duyệt</li>'}</ul>
    ${k.rewards.length ? `<h3>Khen thưởng</h3>${k.rewards.map((w) => `<div>🏆 ${esc(w.full_name)}: <b>${w.points} điểm</b>${w.amount ? ' + ' + money(w.amount) : ''}</div>`).join('')}` : ''}
  </div>`;

  const reload = () => viewDetail(id);
  const act = async (fn, ok) => { try { await fn(); if (ok) toast(ok); reload(); } catch (e) { toast(e.message); } };
  $('#submit')?.addEventListener('click', () => act(() => api(`/kaizens/${id}/submit`, { method: 'POST' }), 'Đã gửi duyệt'));
  $('#complete')?.addEventListener('click', () => act(() => api(`/kaizens/${id}/complete`, { method: 'POST' }), 'Đã cập nhật'));
  $('#up')?.addEventListener('submit', (e) => {
    e.preventDefault(); const fd = new FormData(e.target); fd.append('phase', 'AFTER');
    act(() => api(`/kaizens/${id}/attachments`, { method: 'POST', form: fd }), 'Đã tải ảnh');
  });
  $('#task')?.addEventListener('submit', (e) => {
    e.preventDefault(); act(() => api(`/kaizens/${id}/tasks`, { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }));
  });
  $('#fin')?.addEventListener('submit', (e) => {
    e.preventDefault(); const v = Object.fromEntries(new FormData(e.target));
    act(() => api(`/kaizens/${id}/financials`, { method: 'PUT', body: { investment_cost: +v.investment_cost || 0, annual_saving: +v.annual_saving || 0 } }), 'Đã lưu');
  });
  app.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () =>
    act(() => api(`/kaizens/tasks/${b.dataset.t}/status`, { method: 'PATCH', body: { status: b.dataset.s } }))));
}

async function viewApprovals() {
  const list = await api('/approvals/pending');
  app.innerHTML = `<h2>Chờ tôi phê duyệt (${list.length})</h2>` + (list.map((a) => `
    <div class="card" data-ap="${a.approval_id}">
      <div class="row"><a class="grow" href="#/kaizen/${a.idea_id}"><b>${esc(a.title)}</b></a><span class="badge">${esc(a.level)}</span>
      <span class="badge ${a.waiting_hours >= 48 ? 's-REJECTED' : ''}">${a.waiting_hours}h</span></div>
      <div class="meta">${esc(a.code)} · ${esc(a.category)} · ${esc(a.workshop)} · ${esc(a.submitter)} · Ước tính ${money(a.estimated_saving)}</div>
      <textarea placeholder="Ý kiến phản hồi (bắt buộc khi từ chối / yêu cầu sửa)" style="margin-top:8px"></textarea>
      ${a.level === 'FINANCE' ? `<div class="row"><input data-k="investment_cost" type="number" min="0" placeholder="Chi phí đầu tư xác thực" class="grow" style="width:auto"><input data-k="annual_saving" type="number" min="0" placeholder="Tiết kiệm/năm xác thực" class="grow" style="width:auto"></div>` : ''}
      <div class="row" style="margin-top:8px">
        ${a.level === 'LEADER' ? `<button data-a="APPROVE" data-type="QUICK_WIN">✔ Quick Win</button><button data-a="APPROVE" data-type="MAJOR">✔ Dự án lớn → IE</button>`
          : '<button data-a="APPROVE">✔ Phê duyệt</button>'}
        <button class="sec" data-a="REVISION">Yêu cầu sửa</button><button class="danger" data-a="REJECT">✖ Từ chối</button>
      </div></div>`).join('') || '<div class="card">Không có sáng kiến nào chờ duyệt 🎉</div>');
  app.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', async () => {
    const card = b.closest('[data-ap]');
    const body = { action: b.dataset.a, comment: card.querySelector('textarea').value, kaizen_type: b.dataset.type };
    card.querySelectorAll('[data-k]').forEach((i) => { if (i.value !== '') body[i.dataset.k] = +i.value; });
    try { const r = await api(`/approvals/${card.dataset.ap}/action`, { method: 'POST', body }); toast('→ ' + (STATUS[r.status] || r.status)); viewApprovals(); }
    catch (e) { toast(e.message); }
  }));
}

async function viewDashboard() {
  const s = await api('/reports/summary');
  const roi = ['IE', 'FINANCE', 'DIRECTOR', 'ADMIN', 'LEADER'].includes(role()) ? await api('/reports/roi').catch(() => []) : [];
  const me = await api('/auth/me');
  const max = Math.max(1, ...s.by_category.map((c) => c.total));
  app.innerHTML = `<h2>Dashboard Kaizen</h2>
    <div class="stats">
      ${[['Tổng ý tưởng', s.total_ideas], ['Hoàn thành', s.completed], ['Tỷ lệ hoàn thành', s.completion_rate + ' %'], ['Đang chờ duyệt', s.pending_approval],
        ['Đang triển khai', s.in_progress], ['Quick Win / Dự án', `${s.quick_wins} / ${s.major_projects}`], ['Người tham gia', s.participants],
        ['TG sơ duyệt TB', s.avg_leader_response_hours + ' h'], ['Tiết kiệm ước tính', money(s.estimated_saving)],
        ['Tiết kiệm đã xác thực', money(s.verified_saving)], ['Điểm của tôi', me.total_points]]
        .map(([l, v]) => `<div class="stat"><b>${esc(v)}</b><span>${l}</span></div>`).join('')}
    </div>
    <div class="card" style="margin-top:12px"><h3>Theo lĩnh vực</h3>${s.by_category.map((c) => `
      <div class="row"><span style="width:180px">${esc(c.category)}</span><div class="grow"><div class="bar" style="width:${(c.total / max) * 100}%"></div></div><b>${c.total}</b></div>`).join('') || '<span class="meta">Chưa có dữ liệu</span>'}</div>
    <div class="card"><h3>Top đóng góp</h3><table><tr><th>Nhân viên</th><th>Xưởng</th><th class="num">Ý tưởng</th><th class="num">Điểm</th></tr>
      ${s.top_contributors.map((t) => `<tr><td>${esc(t.full_name)}</td><td>${esc(t.workshop)}</td><td class="num">${t.ideas}</td><td class="num">${t.points}</td></tr>`).join('')}</table></div>
    ${roi.length ? `<div class="card"><h3>ROI theo xưởng / tháng</h3><table><tr><th>Tháng</th><th>Xưởng</th><th class="num">Dự án</th><th class="num">Đầu tư</th><th class="num">Tiết kiệm/năm</th><th class="num">ROI</th><th class="num">Hoàn vốn</th></tr>
      ${roi.map((x) => `<tr><td>${esc(x.month)}</td><td>${esc(x.workshop)}</td><td class="num">${x.projects}</td><td class="num">${money(x.investment)}</td><td class="num">${money(x.annual_saving)}</td><td class="num">${x.roi_percent ?? '—'} %</td><td class="num">${x.payback_months ?? '—'} th</td></tr>`).join('')}</table></div>` : ''}`;
}

// ---------------- boot ----------------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
updateNet();
render();
sync((k) => toast(`Đã đồng bộ ${k} sáng kiến`));
setInterval(() => sync((k) => toast(`Đã đồng bộ ${k} sáng kiến`)), 30000);
