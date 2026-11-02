import { api, session, fileUrl, DEMO } from './api.js';
import { resetDemo } from './mock.js';
import { queue, pending, sync, toForm } from './offline.js';
import { icon, WASTES, WASTE, TOOLS, TOOL, PRINCIPLES, GEMBA_TOOLS, BELTS, beltOf, beltSvg, STATUS, ROLES } from './lean.js';
import { columnChart, barList, ring, spark } from './charts.js';
import { t, LANGS, getLang, setLang, locale, startAutoTranslate } from './i18n.js';

// ============ helpers ============
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $('#app');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = { format: (v) => new Intl.NumberFormat(locale()).format(v) };
const money = (v) => nf.format(Math.round(v || 0)) + ' ₫';
const UNITS = { vi: ['tỷ', 'tr'], en: ['B', 'M'], zh: ['十亿', '百万'], id: ['M', 'jt'] };
const moneyShort = (v) => {
  v = +v || 0;
  const u = UNITS[getLang()];
  if (Math.abs(v) >= 1e9) return (v / 1e9).toLocaleString(locale(), { maximumFractionDigits: 2 }) + ' ' + u[0];
  if (Math.abs(v) >= 1e6) return (v / 1e6).toLocaleString(locale(), { maximumFractionDigits: 1 }) + ' ' + u[1];
  return nf.format(Math.round(v)) + ' ₫';
};
const dt = (v) => (v ? new Date(v).toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const dtt = (v) => (v ? new Date(v).toLocaleString(locale(), { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—');
function ago(v) {
  if (!v) return '';
  const s = (Date.now() - new Date(v)) / 1000;
  if (s < 60) return t('vừa xong');
  if (s < 3600) return t('{n} phút trước', { n: Math.floor(s / 60) });
  if (s < 86400) return t('{n} giờ trước', { n: Math.floor(s / 3600) });
  if (s < 86400 * 30) return t('{n} ngày trước', { n: Math.floor(s / 86400) });
  return dt(v);
}
const initials = (n) => String(n || '?').trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase();
const avatar = (n, cls = '') => `<span class="avatar ${cls}" aria-hidden="true" data-notr>${esc(initials(n))}</span>`;
const pill = (s) => `<span class="pill t-${(STATUS[s] || STATUS.DRAFT).tone}">${esc((STATUS[s] || { vi: s }).vi)}</span>`;
const wasteTags = (list = [], max = 3) => (list || []).slice(0, max).map((w) => WASTE[w] ? `<span class="tag">${icon(WASTE[w].icon, 13)}${WASTE[w].vi}</span>` : '').join('')
  + ((list || []).length > max ? `<span class="tag">+${list.length - max}</span>` : '');
const typeTag = (t) => (t ? `<span class="tag type">${t === 'MAJOR' ? 'Dự án lớn' : 'Quick Win'}</span>` : '');
const toolTag = (t) => (t && TOOL[t] ? `<span class="tag">${icon(TOOL[t].icon, 13)}${TOOL[t].vi}</span>` : '');
const role = () => session.user?.role;
const me = () => session.user || {};
const isApprover = () => ['LEADER', 'IE', 'FINANCE', 'ADMIN'].includes(role());
const empty = (ic, title, text, cta = '') => `<div class="empty">${icon(ic, 34)}<h3>${title}</h3><p>${text}</p>${cta ? `<p style="margin-top:14px">${cta}</p>` : ''}</div>`;

function toast(msg, ic = 'check') {
  const el = $('#toast');
  el.innerHTML = icon(ic, 18) + esc(t(msg)); el.hidden = false;
  clearTimeout(toast.tm); toast.tm = setTimeout(() => (el.hidden = true), 3200);
}

// chart tooltips: any element with data-tip
document.addEventListener('mousemove', (e) => {
  const el = e.target.closest?.('[data-tip]'), tip = $('#tip');
  if (!el) { tip.hidden = true; return; }
  tip.innerHTML = el.dataset.tip; tip.hidden = false;
  const r = tip.getBoundingClientRect();
  tip.style.left = Math.min(innerWidth - r.width - 8, e.clientX + 14) + 'px';
  tip.style.top = Math.max(8, e.clientY - r.height - 10) + 'px';
});

// ============ shell ============
const NAV = [
  ['Vận hành', [['', 'home', 'Tổng quan'], ['ideas', 'bulb', 'Sáng kiến'], ['board', 'board', 'Bảng Kaizen'], ['approvals', 'approve', 'Phê duyệt', ['LEADER', 'IE', 'FINANCE', 'ADMIN']]]],
  ['Hiệu quả', [['analytics', 'chart', 'Phân tích & ROI'], ['leaderboard', 'trophy', 'Bảng vàng']]],
  ['Tri thức', [['academy', 'book', 'Học viện Lean']]],
  ['Hệ thống', [['admin', 'users', 'Quản trị', ['ADMIN']]]],
];
const TITLES = { '': 'Tổng quan', ideas: 'Sáng kiến cải tiến', board: 'Bảng Kaizen', approvals: 'Phê duyệt', analytics: 'Phân tích & ROI', leaderboard: 'Bảng vàng', academy: 'Học viện Lean', admin: 'Quản trị', new: 'Đề xuất sáng kiến', kaizen: 'Chi tiết sáng kiến' };
let pendingCount = 0, myPoints = 0;

function renderShell(route) {
  const u = me(), b = beltOf(myPoints);
  $('#side').innerHTML = `
    <a class="brand" href="#/"><span class="brand-mark">改</span><span><b>Digital Kaizen</b><small>Cải tiến liên tục</small></span></a>
    ${NAV.map(([g, items]) => {
      const vis = items.filter((i) => !i[3] || i[3].includes(u.role));
      return vis.length ? `<div class="nav-group">${g}</div>` + vis.map(([k, ic, label]) => `
        <a class="nav-link ${route === k ? 'active' : ''}" href="#/${k}">${icon(ic, 19)}<span>${label}</span>${k === 'approvals' && pendingCount ? `<span class="count">${pendingCount}</span>` : ''}</a>`).join('') : '';
    }).join('')}
    <div class="side-foot">${beltSvg(b, 36)}<div class="who"><b data-notr>${esc(u.name)}</b><span>${esc(t(ROLES[u.role] || u.role))} · ${t(b.vi)}</span></div>
      <button class="icon-btn" id="logout" title="Đăng xuất" aria-label="Đăng xuất">${icon('logout', 18)}</button></div>`;
  $('#crumb').textContent = TITLES[route] ?? '';
  $('#menu').innerHTML = icon('menu', 22);
  $('#top-new').innerHTML = icon('plus', 18) + 'Đề xuất cải tiến';
  $('#demo-tag').innerHTML = DEMO ? '<span class="demo-tag">DEMO</span>' : '';
  $('#lang').innerHTML = langSelect('lang-top');
  const tab = (k, ic, label) => `<a href="#/${k}" class="${route === k ? 'active' : ''}">${icon(ic, 22)}${label}</a>`;
  $('#tabbar').innerHTML = tab('', 'home', 'Tổng quan') + tab('ideas', 'bulb', 'Sáng kiến')
    + `<a href="#/new" aria-label="Đề xuất cải tiến"><span class="fab">${icon('camera', 24)}</span></a>`
    + (isApprover() ? tab('approvals', 'approve', pendingCount ? t('Duyệt ({n})', { n: pendingCount }) : 'Duyệt') : tab('leaderboard', 'trophy', 'Bảng vàng'))
    + `<button id="more">${icon('menu', 22)}Thêm</button>`;
  $('#logout').onclick = () => { session.clear(); location.hash = '#/login'; };
  $('#more').onclick = $('#menu').onclick = () => document.body.classList.add('drawer');
  $('#scrim').onclick = () => document.body.classList.remove('drawer');
}

function langSelect(id) {
  return `<label class="lang" data-short="${LANGS.find((l) => l.code === getLang()).short}" title="${t('Ngôn ngữ')}">${icon('globe', 16)}<select id="${id}" aria-label="${t('Ngôn ngữ')}" data-notr>${LANGS.map((l) => `<option value="${l.code}" ${l.code === getLang() ? 'selected' : ''}>${l.short} · ${l.label}</option>`).join('')}</select></label>`;
}
document.addEventListener('change', (e) => {
  if (e.target.id === 'lang-top' || e.target.id === 'lang-login') { setLang(e.target.value); updateNet(); render(); }
});

async function refreshCounters() {
  try {
    const [m, p] = await Promise.all([api('/auth/me'), isApprover() ? api('/approvals/pending') : Promise.resolve([])]);
    myPoints = m.total_points || 0; pendingCount = p.length;
  } catch { /* offline */ }
}

function updateNet() {
  const n = $('#net');
  n.classList.toggle('off', !navigator.onLine);
  n.innerHTML = `<span class="net-txt">${navigator.onLine ? 'Trực tuyến' : 'Ngoại tuyến'}</span>`;
}
const synced = (k) => toast(t('Đã đồng bộ {n} sáng kiến', { n: k }), 'refresh');
window.addEventListener('online', () => { updateNet(); sync(synced); });
window.addEventListener('offline', updateNet);

// ============ router ============
const routes = { '': viewHome, ideas: viewIdeas, board: viewBoard, approvals: viewApprovals, analytics: viewAnalytics, leaderboard: viewLeaderboard,
  academy: viewAcademy, admin: viewAdmin, new: viewNew, kaizen: viewDetail };

async function render() {
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const [name = '', id] = path.split('/');
  const params = new URLSearchParams(query || '');
  document.body.classList.remove('drawer');
  if (!session.token || name === 'login') {
    if (params.get('line')) try { sessionStorage.setItem('kz_line', params.get('line')); } catch { /* ignore */ }
    if (session.token && name === 'login') session.clear();
    $('#shell').hidden = true; $('#login').hidden = false;
    return viewLogin();
  }
  $('#login').hidden = true; $('#login').innerHTML = ''; $('#shell').hidden = false;
  const key = routes[name] ? name : '';
  renderShell(key);
  app.innerHTML = '<div class="grid g3"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
  try { await routes[key](id, params); }
  catch (e) { app.innerHTML = `<div class="card">${empty('alert', 'Không tải được trang', esc(e.message), '<a class="btn ghost" href="#/">Về Tổng quan</a>')}</div>`; }
  window.scrollTo(0, 0);
  refreshCounters().then(() => renderShell(key));
}
window.addEventListener('hashchange', render);

// ============ login ============
function viewLogin() {
  const demoUsers = [['CN001', 'Công nhân', 'Gửi ý tưởng, chụp ảnh hiện trường'], ['TT001', 'Tổ trưởng', 'Sơ duyệt, xử lý Quick Win'],
    ['IE001', 'Ban Kaizen / IE', 'Thẩm định kỹ thuật, Kanban'], ['KT001', 'Kế toán', 'Xác thực chi phí và ROI'], ['GD001', 'Giám đốc', 'Theo dõi toàn nhà máy'], ['admin', 'Quản trị', 'Người dùng, xưởng, chuyền']];
  $('#login').innerHTML = `<div class="login">
    <section class="login-art">
      <div class="brand" style="padding:0"><span class="brand-mark">改</span><span><b>Digital Kaizen</b><small>Cải tiến liên tục</small></span></div>
      <h1>Mỗi ý tưởng nhỏ tại chuyền là <em>một bước tiến lớn</em> của nhà máy.</h1>
      <ul>
        <li>${icon('camera')}<span><b>Gửi đề xuất trong 60 giây.</b> Quét QR tại chuyền, chụp ảnh, chọn loại lãng phí. Mất mạng vẫn gửi được.</span></li>
        <li>${icon('approve')}<span><b>Duyệt dưới 48 giờ.</b> Tổ trưởng, Ban Kaizen, Kế toán duyệt theo luồng rõ ràng, có theo dõi SLA.</span></li>
        <li>${icon('coins')}<span><b>ROI được kiểm chứng.</b> Kế toán xác thực tiết kiệm, hệ thống tự cộng điểm và thưởng.</span></li>
        <li>${icon('award')}<span><b>Thăng đai Kaizen.</b> Từ Đai Trắng đến Đai Đen Bậc Thầy theo đóng góp thực tế.</span></li>
      </ul>
      <p class="small" style="color:var(--side-muted)">Nhỏ hôm nay · Mạnh ngày mai</p>
    </section>
    <section class="login-form"><div class="box">
      <div class="row" style="align-items:flex-start"><div class="grow"><h1>Đăng nhập</h1><p class="muted">Dùng mã nhân viên do quản trị cấp.</p></div>${langSelect('lang-login')}</div>
      <form id="lf" class="stack">
        <div class="field"><label class="f" for="lf-code">Mã nhân viên</label><input id="lf-code" name="employee_code" required autocomplete="username" placeholder="VD: CN001"></div>
        <div class="field"><label class="f" for="lf-pw">Mật khẩu</label><input id="lf-pw" name="password" type="password" required autocomplete="current-password"></div>
        <button class="btn lg">Đăng nhập ${icon('arrowR', 18)}</button>
      </form>
      ${DEMO ? `<div class="stack" style="gap:10px"><div class="eyebrow">Bản demo · chọn vai trò để vào nhanh</div>
        <div class="quick">${demoUsers.map(([c, l, d]) => `<button data-quick="${c}">${avatar(l)}<span><b>${l}</b><span>${d}</span></span></button>`).join('')}</div>
        <p class="small muted"><span>Dữ liệu demo chỉ lưu trong trình duyệt của bạn.</span> <button class="linkbtn" id="reset">Khôi phục dữ liệu mẫu</button></p></div>` : ''}
    </div></section></div>`;
  const doLogin = async (fd) => {
    try {
      const r = await api('/auth/login', { method: 'POST', body: fd });
      session.set(r.token, r.user);
      let line = null;
      try { line = sessionStorage.getItem('kz_line'); sessionStorage.removeItem('kz_line'); } catch { /* ignore */ }
      location.hash = line ? `#/new?line=${line}` : '#/';
    } catch (err) { toast(err.message, 'alert'); }
  };
  $('#lf').onsubmit = (e) => { e.preventDefault(); doLogin(Object.fromEntries(new FormData(e.target))); };
  $$('[data-quick]').forEach((b) => (b.onclick = () => doLogin({ employee_code: b.dataset.quick, password: b.dataset.quick === 'admin' ? 'admin123' : '123456' })));
  const rs = $('#reset'); if (rs) rs.onclick = () => { resetDemo(); toast('Đã khôi phục dữ liệu mẫu', 'refresh'); };
}

// ============ home ============
function kpi(ic, label, value, sub = '', extra = '') {
  return `<div class="card kpi"><div class="k-top"><span class="k-ic">${icon(ic, 17)}</span>${label}</div><div class="k-val">${value}</div><div class="k-sub"><span>${sub}</span>${extra}</div></div>`;
}

async function viewHome() {
  const u = me();
  const [m, sum, act, mine, trend, pend] = await Promise.all([api('/auth/me'), api('/reports/summary'), api('/activity').catch(() => []),
    api('/kaizens?mine=true&page_size=100'), api('/reports/trend').catch(() => []), isApprover() ? api('/approvals/pending') : Promise.resolve([])]);
  const b = beltOf(m.total_points || 0);
  const day = Math.floor(Date.now() / 864e5), pr = PRINCIPLES[day % PRINCIPLES.length];
  const hour = new Date().getHours(), greet = hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const assigned = await api('/kaizens?page_size=100&status=QUICK_WIN,IMPLEMENTING').then((r) => r.items.filter((i) => i.assignee_id === u.uid)).catch(() => []);
  const outbox = await pending().catch(() => []);

  const todos = [
    ...outbox.map((o) => ({ ic: 'wifiOff', cls: 'info', t: o.fields.title, s: 'Đang chờ có mạng để đồng bộ', href: '#/ideas' })),
    ...pend.map((a) => ({ ic: 'approve', t: a.title, s: t('Chờ bạn duyệt cấp {lvl} · {h} giờ', { lvl: t(a.level === 'LEADER' ? 'Tổ trưởng' : a.level === 'IE' ? 'Ban Kaizen' : 'Kế toán'), h: a.waiting_hours }), href: '#/approvals' })),
    ...mine.items.filter((i) => i.status === 'REVISION_REQUESTED').map((i) => ({ ic: 'alert', t: i.title, s: 'Người duyệt yêu cầu chỉnh sửa', href: '#/kaizen/' + i.id })),
    ...mine.items.filter((i) => i.status === 'DRAFT').map((i) => ({ ic: 'doc', cls: 'info', t: i.title, s: 'Bản nháp chưa gửi duyệt', href: '#/kaizen/' + i.id })),
    ...assigned.map((i) => ({ ic: i.status === 'QUICK_WIN' ? 'camera' : 'board', cls: 'info', t: i.title, s: i.status === 'QUICK_WIN' ? 'Thực hiện và tải ảnh After' : 'Cập nhật tiến độ Kanban', href: '#/kaizen/' + i.id })),
  ];
  const myDone = mine.items.filter((i) => i.status === 'COMPLETED').length;
  const mySaving = mine.items.filter((i) => i.status === 'COMPLETED').reduce((s, i) => s + (i.estimated_saving || 0), 0);
  const scopeLabel = u.role === 'WORKER' ? 'Sáng kiến của bạn' : u.role === 'LEADER' ? 'Sáng kiến trong xưởng' : 'Sáng kiến toàn nhà máy';
  const feedIc = (k) => k === 'SUBMITTED' ? ['bulb', ''] : k === 'COMPLETED' ? ['trophy', 'good'] : k === 'COMMENT' ? ['message', ''] : k.endsWith('REJECTED') ? ['x', 'bad'] : k.endsWith('APPROVED') ? ['check', 'good'] : ['refresh', ''];
  const feedTxt = (a) => t({ SUBMITTED: 'đã gửi sáng kiến', COMPLETED: 'đã hoàn thành sáng kiến', COMMENT: 'đã bình luận về' }[a.kind]
    || (a.kind.endsWith('APPROVED') ? '{who} đã duyệt' : a.kind.endsWith('REJECTED') ? '{who} đã từ chối' : '{who} yêu cầu sửa'), { who: t({ LEADER: 'Tổ trưởng', IE: 'Ban Kaizen', FINANCE: 'Kế toán' }[a.kind.split('_')[0]] || '') });

  app.innerHTML = `
    <section class="hero">
      <div class="card hello">
        <div class="date">${new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <h1>${t(greet)}, <span data-notr>${esc(u.name.split(' ').slice(-1)[0])}</span>.</h1>
        <div class="quote"><b>Nguyên tắc Kaizen hôm nay</b>${esc(t(pr[1]))}. ${esc(t(pr[2]))}</div>
        <div class="row"><a class="btn" href="#/new">${icon('camera', 18)}Đề xuất cải tiến</a><a class="btn ghost" href="#/academy">${icon('book', 18)}Học viện Lean</a></div>
      </div>
      <div class="card beltcard">
        <div class="b-head">${beltSvg(b, 64)}<div class="grow"><div class="eyebrow">Cấp đai Kaizen của bạn</div><div class="b-name">${t(b.vi)}</div><div class="muted small">${t('{n} điểm cải tiến', { n: m.total_points || 0 })}</div></div></div>
        <div class="progress" role="progressbar" aria-valuenow="${b.pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${b.pct}%"></span></div>
        <div class="small muted">${b.next ? t('Còn {n} điểm để lên {belt}. Mỗi Quick Win +10, mỗi dự án lớn +50.', { n: `<b>${b.toNext}</b>`, belt: `<b>${t(b.next.vi)}</b>` }) : t('Bạn đã đạt cấp đai cao nhất.')}</div>
        <div class="ladder">${BELTS.map((x, i) => `<span style="background:${x.color};opacity:${i <= b.index ? 1 : .3}" title="${t(x.vi)}"></span>`).join('')}</div>
        <a href="#/leaderboard" class="small" style="font-weight:600">Xem Bảng vàng ${icon('chevR', 14)}</a>
      </div>
    </section>

    <section class="grid g4" style="margin-bottom:20px">
      ${kpi('bulb', scopeLabel, sum.total_ideas, t('{n} người tham gia', { n: sum.participants }), spark(trend.map((x) => +x.submitted)))}
      ${kpi('check', 'Đã hoàn thành', sum.completed, t('Tỷ lệ hoàn thành {n}%', { n: sum.completion_rate }), spark(trend.map((x) => +x.completed)))}
      ${kpi('coins', 'Tiết kiệm đã xác thực', moneyShort(sum.verified_saving), t('Ước tính {v}/năm', { v: moneyShort(sum.estimated_saving) }))}
      ${kpi('clock', 'Thời gian sơ duyệt TB', `${sum.avg_leader_response_hours}<small> giờ</small>`, sum.avg_leader_response_hours <= 48 ? '<span style="color:var(--good);font-weight:700">Đạt mục tiêu dưới 48 giờ</span>' : '<span style="color:var(--bad);font-weight:700">Vượt mục tiêu 48 giờ</span>')}
    </section>

    <section class="card" style="margin-bottom:20px">
      <div class="card-h"><h2>Săn lãng phí tại Gemba</h2><span class="muted small">Thấy lãng phí nào? Chạm để đề xuất ngay</span></div>
      <div class="card-b"><div class="waste-strip">${WASTES.map((w) => `<button class="waste-btn" data-waste="${w.code}">${icon(w.icon, 24)}${w.vi}</button>`).join('')}</div></div>
    </section>

    <section class="grid g2">
      <div class="card">
        <div class="card-h"><h2>Việc cần làm</h2><span class="pill ${todos.length ? 't-warn' : 't-good'}">${todos.length}</span></div>
        ${todos.length ? todos.slice(0, 8).map((x) => `<a class="todo" href="${x.href}"><span class="t-ic ${x.cls || ''}">${icon(x.ic, 18)}</span><span class="t-main"><b data-notr>${esc(x.t)}</b><span>${esc(t(x.s))}</span></span>${icon('chevR', 16)}</a>`).join('')
          : empty('check', 'Không còn việc tồn', 'Bạn đã xử lý xong mọi việc. Hãy đi một vòng Gemba để tìm cơ hội cải tiến mới.')}
        <div class="card-b" style="border-top:1px solid var(--line-2)"><div class="row"><span class="grow small muted">Sáng kiến của tôi: <b style="color:var(--ink)">${mine.total}</b> · hoàn thành <b style="color:var(--ink)">${myDone}</b> · ước tính tiết kiệm <b style="color:var(--ink)">${moneyShort(mySaving)}</b></span><a class="small" style="font-weight:600" href="#/ideas?mine=true">Xem tất cả</a></div></div>
      </div>
      <div class="card">
        <div class="card-h"><h2>Hoạt động gần đây</h2></div>
        ${act.length ? `<ul class="feed">${act.slice(0, 8).map((a) => { const [ic, c] = feedIc(a.kind); return `<li><span class="f-ic ${c}">${icon(ic, 15)}</span>
          <div class="f-txt"><b data-notr>${esc(a.actor)}</b> ${feedTxt(a)} <a href="#/kaizen/${a.idea_id}" data-notr>${esc(a.title)}</a>${a.detail ? `<q data-notr>${esc(a.detail)}</q>` : ''}<time style="display:block">${ago(a.at)}</time></div></li>`; }).join('')}</ul>`
          : empty('clock', 'Chưa có hoạt động', 'Các sự kiện gửi, duyệt, bình luận sẽ hiển thị ở đây.')}
      </div>
    </section>`;
  $$('[data-waste]').forEach((b2) => (b2.onclick = () => (location.hash = '#/new?waste=' + b2.dataset.waste)));
}

// ============ ideas list ============
const GROUPS = [['', 'Tất cả'], ['PENDING_LEADER,PENDING_IE,PENDING_FINANCE,REVISION_REQUESTED', 'Chờ duyệt'], ['QUICK_WIN,IMPLEMENTING', 'Đang thực hiện'],
  ['COMPLETED', 'Hoàn thành'], ['REJECTED', 'Từ chối'], ['DRAFT', 'Nháp']];

function ideaCard(k) {
  const img = k.thumb_id ? fileUrl(k.thumb_id) : '';
  const w = (k.waste_types || [])[0];
  return `<a class="card idea" href="#/kaizen/${k.id}">
    <div class="thumb ${img ? '' : 'ph'}">${img ? `<img loading="lazy" src="${img}" alt="">` : icon(w && WASTE[w] ? WASTE[w].icon : 'bulb', 40)}${pill(k.status)}</div>
    <div class="i-body">
      <div class="i-meta"><span class="mono">${esc(k.code)}</span> · ${esc(t(k.category))} · <span data-notr>${esc(k.workshop)}${k.line ? ' / ' + esc(k.line) : ''}</span></div>
      <div class="i-title" data-notr>${esc(k.title)}</div>
      <div class="chips">${typeTag(k.kaizen_type)}${wasteTags(k.waste_types, 2)}</div>
    </div>
    <div class="i-foot">${avatar(k.submitter)}<span class="grow" style="min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span data-notr>${esc(k.submitter)}</span><br>${ago(k.submitted_at || k.created_at)}</span>
      <span class="stat-ic">${icon('heart', 14)}${k.like_count || 0}</span><span class="stat-ic">${icon('message', 14)}${k.comment_count || 0}</span>
      ${k.estimated_saving ? `<span class="save">${moneyShort(k.estimated_saving)}</span>` : ''}</div></a>`;
}

async function viewIdeas(_, params) {
  const st = { status: params.get('status') || '', q: '', waste: params.get('waste') || '', type: '', mine: params.get('mine') === 'true' };
  app.innerHTML = `
    <div class="page-h"><div class="grow"><h1>Sáng kiến cải tiến</h1><p>Mọi ý tưởng trong phạm vi bạn được xem, từ lúc gửi đến khi được khen thưởng.</p></div>
      ${DEMO ? '' : `<a class="btn ghost" href="/api/v1/reports/export.csv" id="export">${icon('download', 18)}Xuất Excel</a>`}
      <a class="btn" href="#/new">${icon('plus', 18)}Đề xuất mới</a></div>
    <div class="filters">
      <div class="search">${icon('search', 18)}<input id="f-q" type="search" placeholder="Tìm theo tiêu đề hoặc mã KZ…" aria-label="Tìm kiếm"></div>
      <select id="f-waste" aria-label="Loại lãng phí"><option value="">Mọi loại lãng phí</option>${WASTES.map((w) => `<option value="${w.code}" ${st.waste === w.code ? 'selected' : ''}>${w.vi}</option>`).join('')}</select>
      <select id="f-type" aria-label="Loại cải tiến"><option value="">Quick Win và Dự án</option><option value="QUICK_WIN">Quick Win</option><option value="MAJOR">Dự án lớn</option></select>
      <button class="chip ${st.mine ? 'on' : ''}" id="f-mine">${icon('user', 15)}Của tôi</button>
    </div>
    <div class="chips" id="f-status" style="margin-bottom:16px">${GROUPS.map(([v, l]) => `<button class="chip ${st.status === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
    <div id="out"></div><div id="items"></div>`;
  const exp = $('#export');
  if (exp) exp.onclick = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/v1/reports/export.csv', { headers: { Authorization: 'Bearer ' + session.token } });
    const url = URL.createObjectURL(await res.blob()), a = document.createElement('a');
    a.href = url; a.download = 'kaizen-export.csv'; a.click(); URL.revokeObjectURL(url);
  };
  const outbox = await pending().catch(() => []);
  if (outbox.length) $('#out').innerHTML = `<div class="card pad" style="margin-bottom:16px;display:flex;gap:12px;align-items:center">${icon('wifiOff', 22)}<div><b>${t('{n} sáng kiến đang chờ đồng bộ', { n: outbox.length })}</b><div class="small muted" data-notr>${outbox.map((o) => esc(o.fields.title)).join(' · ')}</div></div></div>`;

  const load = async () => {
    const qs = new URLSearchParams({ page_size: 100 });
    Object.entries(st).forEach(([k, v]) => v && qs.set(k, v === true ? 'true' : v));
    const res = await api('/kaizens?' + qs);
    $('#items').innerHTML = res.items.length ? `<p class="small muted" style="margin-bottom:10px">${t('{n} sáng kiến', { n: res.total })}</p><div class="ideas">${res.items.map(ideaCard).join('')}</div>`
      : `<div class="card">${empty('search', 'Không có sáng kiến phù hợp', 'Thử bỏ bớt bộ lọc, hoặc gửi đề xuất đầu tiên cho nhóm này.', '<a class="btn" href="#/new">Đề xuất cải tiến</a>')}</div>`;
  };
  let tmr;
  $('#f-q').oninput = (e) => { clearTimeout(tmr); tmr = setTimeout(() => { st.q = e.target.value.trim(); load(); }, 250); };
  $('#f-waste').onchange = (e) => { st.waste = e.target.value; load(); };
  $('#f-type').onchange = (e) => { st.type = e.target.value; load(); };
  $('#f-mine').onclick = (e) => { st.mine = !st.mine; e.currentTarget.classList.toggle('on', st.mine); load(); };
  $$('#f-status .chip').forEach((c) => (c.onclick = () => { st.status = c.dataset.v; $$('#f-status .chip').forEach((x) => x.classList.toggle('on', x === c)); load(); }));
  await load();
}

// ============ board ============
async function viewBoard() {
  const res = await api('/kaizens?page_size=100');
  const lanes = [['PENDING_LEADER', 'Chờ sơ duyệt', 'var(--warn)'], ['QUICK_WIN', 'Quick Win tại chuyền', 'var(--info)'], ['PENDING_IE', 'Chờ Ban Kaizen', 'var(--warn)'],
    ['IMPLEMENTING', 'Đang triển khai', 'var(--info)'], ['PENDING_FINANCE', 'Thẩm định ROI', 'var(--warn)'], ['COMPLETED', 'Hoàn thành', 'var(--good)']];
  app.innerHTML = `<div class="page-h"><div class="grow"><h1>Bảng Kaizen</h1><p>Dòng chảy của mọi sáng kiến qua từng chặng phê duyệt. Cột dồn nhiều thẻ là nơi đang tắc nghẽn.</p></div></div>
    <div class="board-wrap"><div class="board">${lanes.map(([s, l, c]) => { const items = res.items.filter((i) => i.status === s); return `
      <section class="lane" style="--dot:${c}"><div class="lane-h">${l}<span class="n">${items.length}</span></div><div class="lane-b">
        ${items.map((k) => `<a class="mini" href="#/kaizen/${k.id}"><span class="mono muted">${esc(k.code)}</span><b data-notr>${esc(k.title)}</b>
          <div class="row">${avatar(k.submitter)}<span class="grow" data-notr>${esc(k.submitter)}</span>${k.estimated_saving ? `<b style="margin:0;color:var(--good)">${moneyShort(k.estimated_saving)}</b>` : ''}</div>
          ${(k.waste_types || []).length ? `<div class="chips" style="margin-top:8px">${wasteTags(k.waste_types, 2)}</div>` : ''}</a>`).join('') || '<p class="small muted" style="padding:8px">Trống</p>'}
      </div></section>`; }).join('')}</div></div>`;
}

// ============ approvals ============
async function viewApprovals() {
  const list = await api('/approvals/pending');
  const lvl = { LEADER: 'Sơ duyệt cấp Tổ', IE: 'Thẩm định Ban Kaizen', FINANCE: 'Thẩm định tài chính' };
  app.innerHTML = `<div class="page-h"><div class="grow"><h1>Phê duyệt</h1><p>Mục tiêu: phản hồi mọi sáng kiến trong vòng 48 giờ. Lý do là bắt buộc khi từ chối hoặc yêu cầu sửa.</p></div>
      <span class="pill ${list.length ? 't-warn' : 't-good'}">${t('{n} đang chờ', { n: list.length })}</span></div>
    <div class="stack">${list.map((a) => `
      <article class="card ap" data-ap="${a.approval_id}">
        ${a.thumb_id ? `<img class="ap-img" src="${fileUrl(a.thumb_id)}" alt="Ảnh hiện trường">` : `<div class="ap-img">${icon('image', 30)}</div>`}
        <div style="min-width:0">
          <div class="row"><span class="tag type">${lvl[a.level]}</span><span class="sla ${a.waiting_hours > 48 ? 'late' : 'ok'}">${icon('clock', 14)}${t(a.waiting_hours > 48 ? '{h} giờ · quá hạn' : '{h} giờ', { h: a.waiting_hours })}</span><span class="grow"></span><span class="mono muted">${esc(a.code)}</span></div>
          <h2 style="margin-top:6px" data-notr><a href="#/kaizen/${a.idea_id}" style="color:var(--ink)">${esc(a.title)}</a></h2>
          <div class="small muted"><span data-notr>${esc(a.submitter)} · ${esc(a.workshop)}</span> · ${esc(t(a.category))}${a.estimated_saving ? ` · ${t('Ước tính {v}/năm', { v: `<b style="color:var(--good)">${money(a.estimated_saving)}</b>` })}` : ''}</div>
          ${a.problem ? `<div class="ap-pair"><div><span class="eyebrow" style="color:var(--bad)">Hiện trạng</span><p data-notr>${esc(a.problem)}</p></div><div><span class="eyebrow" style="color:var(--good)">Đề xuất</span><p data-notr>${esc(a.proposal)}</p></div></div>` : ''}
          <div class="chips">${wasteTags(a.waste_types, 4)}${toolTag(a.lean_tool)}</div>
          <textarea placeholder="Ý kiến phản hồi cho người đề xuất (bắt buộc khi từ chối / yêu cầu sửa)" style="margin-top:12px;min-height:64px" aria-label="Ý kiến phản hồi"></textarea>
          ${a.level === 'FINANCE' ? `<div class="grid g2" style="margin-top:8px"><div class="field"><label class="f">Chi phí đầu tư thực tế (₫)</label><input data-k="investment_cost" type="number" min="0" step="1000"></div>
            <div class="field"><label class="f">Tiết kiệm / năm đã xác thực (₫)</label><input data-k="annual_saving" type="number" min="0" step="1000"></div></div>` : ''}
          <div class="ap-actions">
            ${a.level === 'LEADER' ? `<button class="btn" data-a="APPROVE" data-type="QUICK_WIN">${icon('zap', 16)}Duyệt · Quick Win</button><button class="btn ghost" data-a="APPROVE" data-type="MAJOR">${icon('board', 16)}Duyệt · Dự án lớn → IE</button>`
              : `<button class="btn" data-a="APPROVE">${icon('check', 16)}${a.level === 'FINANCE' ? 'Xác thực & hoàn thành' : 'Phê duyệt triển khai'}</button>`}
            <button class="btn ghost" data-a="REVISION">${icon('refresh', 16)}Yêu cầu sửa</button>
            <button class="btn danger" data-a="REJECT">${icon('x', 16)}Từ chối</button>
          </div>
        </div>
      </article>`).join('') || `<div class="card">${empty('check', 'Không có sáng kiến nào chờ bạn', 'Mọi đề xuất đã được phản hồi đúng hạn. Làm tốt lắm!')}</div>`}</div>`;
  $$('[data-a]').forEach((b) => b.addEventListener('click', async () => {
    const card = b.closest('[data-ap]');
    const body = { action: b.dataset.a, comment: $('textarea', card).value, kaizen_type: b.dataset.type };
    $$('[data-k]', card).forEach((i) => { if (i.value !== '') body[i.dataset.k] = +i.value; });
    try {
      const r = await api(`/approvals/${card.dataset.ap}/action`, { method: 'POST', body });
      toast(t('Đã chuyển sang: {s}', { s: t(STATUS[r.status]?.vi || r.status) })); render();
    } catch (e) { toast(e.message, 'alert'); }
  }));
}

// ============ detail ============
function lifecycle(k) {
  const major = k.kaizen_type === 'MAJOR', quick = k.kaizen_type === 'QUICK_WIN';
  const steps = [['DRAFT', 'Gửi đề xuất', 'bulb'], ['PENDING_LEADER', 'Sơ duyệt', 'approve']];
  if (major) steps.push(['PENDING_IE', 'Ban Kaizen', 'users'], ['IMPLEMENTING', 'Triển khai', 'board'], ['PENDING_FINANCE', 'Thẩm định ROI', 'coins']);
  else steps.push([quick ? 'QUICK_WIN' : 'IMPLEMENTING', quick ? 'Làm tại chuyền' : 'Triển khai', 'zap']);
  steps.push(['COMPLETED', 'Hoàn thành', 'trophy']);
  let cur = steps.findIndex((s) => s[0] === k.status), fail = -1;
  if (k.status === 'REVISION_REQUESTED') cur = 0;
  if (k.status === 'COMPLETED') cur = steps.length;
  if (k.status === 'REJECTED') {
    const lv = (k.approvals.find((a) => a.status === 'REJECTED') || {}).level;
    fail = lv === 'IE' ? 2 : lv === 'FINANCE' ? 4 : 1; cur = fail;
  }
  return `<div class="card stepper" style="margin-bottom:20px">${steps.map((s, i) => {
    const c = i === fail ? 'fail' : i < cur ? 'done' : i === cur ? 'cur' : '';
    return `<div class="step ${c}"><span class="dot">${icon(c === 'done' ? 'check' : c === 'fail' ? 'x' : s[2], 15)}</span>${t(i === fail ? 'Bị từ chối' : s[1])}</div>`;
  }).join('')}</div>`;
}

async function viewDetail(id) {
  const k = await api('/kaizens/' + id);
  const u = me(), r = role();
  const isOwner = k.assignee_id === u.uid, isSubmitter = k.submitter_id === u.uid;
  const working = ['QUICK_WIN', 'IMPLEMENTING'].includes(k.status);
  const canTasks = isOwner || ['IE', 'ADMIN', 'LEADER'].includes(r);
  const canComplete = (k.status === 'QUICK_WIN' && (isOwner || ['LEADER', 'ADMIN'].includes(r))) || (k.status === 'IMPLEMENTING' && (isOwner || ['IE', 'ADMIN'].includes(r)));
  const canFin = ['IE', 'FINANCE', 'ADMIN'].includes(r) && !['COMPLETED', 'REJECTED'].includes(k.status) && k.kaizen_type === 'MAJOR';
  const f = k.financials;
  const imgs = (phase) => { const a = k.attachments.filter((x) => x.phase === phase); return a.length ? a.map((x) => x.content_type.startsWith('image/')
    ? `<a href="${fileUrl(x.id)}" target="_blank" rel="noopener"><img loading="lazy" src="${fileUrl(x.id)}" alt="${esc(x.file_name)}"></a>`
    : `<a class="tag" href="${fileUrl(x.id)}" target="_blank" rel="noopener">${icon('doc', 13)}${esc(x.file_name)}</a>`).join('') : `<span class="none">${t(phase === 'AFTER' ? 'Chưa có ảnh sau cải tiến' : 'Chưa có ảnh hiện trạng')}</span>`; };
  const tasksBy = (s) => k.tasks.filter((t) => t.status === s);

  app.innerHTML = `
    <a class="back" href="#/ideas">${icon('chevL', 16)}Danh sách sáng kiến</a>
    <div class="d-head"><div class="grow"><div class="row small muted" style="margin-bottom:6px"><span class="mono">${esc(k.code)}</span>·<span>${esc(t(k.category))}</span>·<span data-notr>${esc(k.workshop)}${k.line ? ' / ' + esc(k.line) : ''}</span></div>
      <h1 data-notr>${esc(k.title)}</h1><div class="chips" style="margin-top:10px">${pill(k.status)}${typeTag(k.kaizen_type)}${toolTag(k.lean_tool)}</div></div>
      <button class="btn ghost like ${k.liked ? 'on' : ''}" id="like">${icon('heart', 18)}${t('{n} ủng hộ', { n: k.like_count || 0 })}</button></div>
    ${lifecycle(k)}
    <div class="main-side">
      <div class="stack">
        <section class="card"><div class="compare">
          <div class="before"><span class="lbl">${icon('alert', 14)}Trước cải tiến · Hiện trạng</span><p data-notr>${esc(k.problem)}</p><div class="gallery">${imgs('BEFORE')}</div></div>
          <div class="after"><span class="lbl">${icon('sparkles', 14)}Sau cải tiến · Giải pháp</span><p data-notr>${esc(k.proposal)}</p><div class="gallery">${imgs('AFTER')}</div>
            ${working ? `<label class="btn ghost sm" style="margin-top:10px">${icon('upload', 15)}Tải ảnh After<input type="file" id="up-after" accept="image/*,video/*" capture="environment" multiple hidden></label>` : ''}</div>
        </div>
        ${k.expected_benefit ? `<div class="card-b" style="border-top:1px solid var(--line-2)"><span class="eyebrow">Lợi ích mong đợi</span><p data-notr>${esc(k.expected_benefit)}</p></div>` : ''}
        ${(k.waste_types || []).length ? `<div class="card-b" style="border-top:1px solid var(--line-2)"><span class="eyebrow">Lãng phí được loại bỏ</span><div class="chips" style="margin-top:6px">${wasteTags(k.waste_types, 8)}</div></div>` : ''}
        </section>

        ${k.kaizen_type === 'MAJOR' ? `<section class="card"><div class="card-h"><h2>Kanban triển khai</h2><span class="muted small">${t('{a}/{b} hoàn thành', { a: tasksBy('DONE').length, b: k.tasks.length })}</span></div><div class="card-b">
          <div class="kanban">${[['TODO', 'Cần làm'], ['IN_PROGRESS', 'Đang làm'], ['DONE', 'Hoàn thành']].map(([s, l]) => `<div class="kcol"><h4>${l}<span>${tasksBy(s).length}</span></h4>
            ${tasksBy(s).map((x) => `<div class="ktask"><b data-notr>${esc(x.title)}</b><span class="small muted">${x.assignee ? `<span data-notr>${esc(x.assignee)}</span>` : t('Chưa giao')}${x.due_date ? ' · ' + t('hạn {d}', { d: dt(x.due_date) }) : ''}</span>
              ${working && canTasks ? `<div class="k-act">${s !== 'TODO' ? `<button data-t="${x.id}" data-s="${s === 'DONE' ? 'IN_PROGRESS' : 'TODO'}" aria-label="Lùi">${icon('chevL', 13)}</button>` : '<span></span>'}
                ${s !== 'DONE' ? `<button data-t="${x.id}" data-s="${s === 'TODO' ? 'IN_PROGRESS' : 'DONE'}" aria-label="Tiến">${icon('chevR', 13)}</button>` : ''}</div>` : ''}</div>`).join('')}</div>`).join('')}</div>
          ${canTasks && ['IMPLEMENTING', 'PENDING_IE'].includes(k.status) ? `<form id="task" class="row" style="margin-top:12px"><input name="title" placeholder="Thêm công việc triển khai…" required class="grow" style="flex:1 1 200px" aria-label="Tên công việc"><input name="due_date" type="date" style="width:auto" aria-label="Hạn"><button class="btn">${icon('plus', 16)}Thêm</button></form>` : ''}
        </div></section>` : ''}

        <section class="card"><div class="card-h"><h2>Thảo luận</h2><span class="muted small">${t('{n} bình luận', { n: k.comments.length })}</span></div><div class="card-b stack">
          <div class="comments">${k.comments.map((c) => `<div class="cmt">${avatar(c.full_name)}<div class="bubble"><b data-notr>${esc(c.full_name)}</b> <span class="small muted">· ${esc(t(ROLES[c.role] || ''))} · ${ago(c.created_at)}</span><p data-notr>${esc(c.body)}</p></div></div>`).join('') || '<p class="small muted">Chưa có bình luận. Hãy góp ý để ý tưởng tốt hơn.</p>'}</div>
          <form id="cmt" class="row" style="align-items:flex-end"><textarea name="body" required maxlength="2000" placeholder="Góp ý, đặt câu hỏi, chia sẻ kinh nghiệm…" style="min-height:48px;flex:1 1 240px" aria-label="Bình luận"></textarea><button class="btn">${icon('send', 16)}Gửi</button></form>
        </div></section>
      </div>

      <aside class="stack">
        ${(['DRAFT', 'REVISION_REQUESTED'].includes(k.status) && isSubmitter) || canComplete ? `<section class="card pad stack" style="gap:10px">
          <h3>Việc tiếp theo</h3>
          ${['DRAFT', 'REVISION_REQUESTED'].includes(k.status) && isSubmitter ? `<button class="btn" id="submit">${icon('send', 16)}Gửi duyệt</button>` : ''}
          ${canComplete ? `<p class="small muted">${k.status === 'QUICK_WIN' ? 'Cần ít nhất một ảnh After.' : 'Mọi công việc phải xong và có ảnh After.'}</p><button class="btn" id="complete">${icon('check', 16)}${k.status === 'QUICK_WIN' ? 'Hoàn thành Quick Win' : 'Hoàn thành, chuyển Kế toán'}</button>` : ''}
        </section>` : ''}
        <section class="card pad stack" style="gap:12px"><h3>Thông tin</h3><dl class="kv">
          <dt>Người đề xuất</dt><dd data-notr>${esc(k.submitter)}</dd>
          <dt>Người phụ trách</dt><dd data-notr>${esc(k.assignee || '—')}</dd>
          <dt>Ngày gửi</dt><dd>${dt(k.submitted_at)}</dd>
          <dt>Hoàn thành</dt><dd>${dt(k.completed_at)}</dd>
          <dt>Ước tính tiết kiệm</dt><dd>${t('{v}/năm', { v: money(k.estimated_saving) })}</dd></dl></section>
        ${f || canFin ? `<section class="card pad stack" style="gap:12px"><div class="row"><h3 class="grow">Hiệu quả tài chính</h3>${f?.verified ? '<span class="pill t-good">Đã xác thực</span>' : '<span class="pill t-neutral">Dự toán</span>'}</div>
          ${f ? `<div class="roi-big num">${f.roi_percent != null ? f.roi_percent + '%' : '—'}<small>ROI năm đầu</small></div>
            <dl class="kv"><dt>Chi phí đầu tư</dt><dd>${money(f.investment_cost)}</dd><dt>Tiết kiệm / năm</dt><dd>${money(f.annual_saving)}</dd>
            <dt>Hoàn vốn</dt><dd>${f.payback_months != null ? t('{n} tháng', { n: f.payback_months }) : '—'}</dd>${f.verified ? `<dt>Xác thực</dt><dd>${dt(f.verified_at)}</dd>` : ''}</dl>` : '<p class="small muted">Chưa nhập số liệu.</p>'}
          ${canFin ? `<form id="fin" class="stack" style="gap:8px"><input name="investment_cost" type="number" min="0" step="1000" placeholder="Chi phí đầu tư (₫)" value="${f?.investment_cost ?? ''}" aria-label="Chi phí đầu tư"><input name="annual_saving" type="number" min="0" step="1000" placeholder="Tiết kiệm / năm (₫)" value="${f?.annual_saving ?? ''}" aria-label="Tiết kiệm mỗi năm"><button class="btn ghost">Lưu dự toán</button></form>` : ''}
        </section>` : ''}
        ${k.rewards.length ? `<section class="card pad stack" style="gap:8px"><h3>Khen thưởng</h3>${k.rewards.map((w) => `<div class="reward">${icon('award', 22)}<div><b data-notr>${esc(w.full_name)}</b><div class="small">${w.amount ? t('+{p} điểm · thưởng {v}', { p: w.points, v: money(w.amount) }) : t('+{p} điểm', { p: w.points })}</div></div></div>`).join('')}</section>` : ''}
        <section class="card pad stack" style="gap:12px"><h3>Lịch sử phê duyệt</h3>
          <ul class="timeline">${k.approvals.map((a) => `<li class="${a.status}"><b>${t({ LEADER: 'Tổ trưởng', IE: 'Ban Kaizen', FINANCE: 'Kế toán' }[a.level])}</b> · ${t({ PENDING: 'đang chờ', APPROVED: 'đã duyệt', REJECTED: 'từ chối', REVISION: 'yêu cầu sửa' }[a.status])}
            <div class="small muted">${a.acted_by ? `<span data-notr>${esc(a.acted_by)}</span> · ` : ''}${dtt(a.acted_at || a.created_at)}</div>${a.comment ? `<q data-notr>${esc(a.comment)}</q>` : ''}</li>`).join('') || '<li class="small muted">Chưa gửi duyệt</li>'}</ul></section>
      </aside>
    </div>`;

  const act = async (fn, ok) => { try { await fn(); if (ok) toast(ok); viewDetail(id); } catch (e) { toast(e.message, 'alert'); } };
  $('#like').onclick = () => act(() => api(`/kaizens/${id}/like`, { method: 'POST' }));
  $('#submit')?.addEventListener('click', () => act(() => api(`/kaizens/${id}/submit`, { method: 'POST' }), 'Đã gửi duyệt'));
  $('#complete')?.addEventListener('click', () => act(() => api(`/kaizens/${id}/complete`, { method: 'POST' }), 'Đã cập nhật trạng thái'));
  $('#up-after')?.addEventListener('change', (e) => { const fd = new FormData(); [...e.target.files].forEach((x) => fd.append('files', x)); fd.append('phase', 'AFTER'); act(() => api(`/kaizens/${id}/attachments`, { method: 'POST', form: fd }), 'Đã tải ảnh After'); });
  $('#task')?.addEventListener('submit', (e) => { e.preventDefault(); act(() => api(`/kaizens/${id}/tasks`, { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }), 'Đã thêm công việc'); });
  $('#cmt').addEventListener('submit', (e) => { e.preventDefault(); act(() => api(`/kaizens/${id}/comments`, { method: 'POST', body: Object.fromEntries(new FormData(e.target)) })); });
  $('#fin')?.addEventListener('submit', (e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(e.target)); act(() => api(`/kaizens/${id}/financials`, { method: 'PUT', body: { investment_cost: +v.investment_cost || 0, annual_saving: +v.annual_saving || 0 } }), 'Đã lưu dự toán'); });
  $$('[data-t]').forEach((b) => b.addEventListener('click', () => act(() => api(`/kaizens/tasks/${b.dataset.t}/status`, { method: 'PATCH', body: { status: b.dataset.s } }))));
}

// ============ new idea wizard ============
async function viewNew(_, params) {
  const [cats, master] = await Promise.all([api('/categories'), api('/master')]);
  let qrLine = null;
  if (params.get('line')) qrLine = await api('/lines/qr/' + encodeURIComponent(params.get('line'))).catch(() => null);
  const u = me();
  const lines = master.lines.filter((l) => !u.wid || l.workshop_id === u.wid);
  const d = { title: '', category_id: cats[0]?.id, line_id: '', problem: '', waste_types: params.get('waste') ? [params.get('waste')] : [], proposal: '', expected_benefit: '', lean_tool: '', estimated_saving: 0, files: [] };
  let step = 0;
  const STEPS = ['Vấn đề tại Gemba', 'Giải pháp cải tiến', 'Hình ảnh & gửi'];

  const draw = () => {
    app.innerHTML = `<div class="wizard">
      <div class="page-h"><div class="grow"><h1>Đề xuất cải tiến</h1><p>${qrLine ? `${icon('factory', 16)} <span data-notr>${esc(qrLine.workshop_name)} / <b>${esc(qrLine.name)}</b></span> ${t('(quét QR)')}` : 'Mô tả điều bạn thấy, điều bạn muốn thay đổi, và chụp ảnh hiện trường.'}</p></div></div>
      <div class="wsteps">${STEPS.map((s, i) => `<div class="wstep ${i === step ? 'on' : i < step ? 'done' : ''}"><span class="n">${i < step ? '✓' : i + 1}</span><span class="t">${t(s)}</span></div>`).join('')}</div>
      <form class="card pad stack" id="wf" novalidate>${[stepProblem, stepSolution, stepReview][step]()}</form>
      <div class="wfoot">${step ? `<button class="btn ghost" id="prev">${icon('chevL', 16)}Quay lại</button>` : '<span></span>'}
        <div class="row">${step === 2 ? `<button class="btn ghost" id="draft">Lưu nháp</button><button class="btn lg" id="send">${icon('send', 18)}Gửi duyệt</button>` : `<button class="btn lg" id="next">Tiếp tục${icon('arrowR', 18)}</button>`}</div></div></div>`;
    bind();
  };
  const stepProblem = () => `
    <div class="field"><label class="f" for="w-title">Tiêu đề ngắn gọn *</label><input id="w-title" name="title" maxlength="255" value="${esc(d.title)}" placeholder="VD: Gắn nam châm giữ kéo tại bàn may"></div>
    <div class="grid g2"><div class="field"><label class="f" for="w-cat">Lĩnh vực *</label><select id="w-cat" name="category_id">${cats.map((c) => `<option value="${c.id}" ${+d.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      ${qrLine ? '' : `<div class="field"><label class="f" for="w-line">Dây chuyền</label><select id="w-line" name="line_id"><option value="">Theo hồ sơ của tôi</option>${lines.map((l) => `<option value="${l.id}" ${+d.line_id === l.id ? 'selected' : ''}>${esc(l.code)} · ${esc(l.name)}</option>`).join('')}</select></div>`}</div>
    <div class="field"><label class="f" for="w-problem">Hiện trạng / vấn đề bạn thấy *</label><textarea id="w-problem" name="problem" placeholder="Chuyện gì đang xảy ra? Mất bao lâu, xảy ra bao nhiêu lần?">${esc(d.problem)}</textarea></div>
    <div class="field"><label class="f">Loại lãng phí (chọn một hoặc nhiều)</label><div class="picker">${WASTES.map((w) => `<button type="button" class="pick ${d.waste_types.includes(w.code) ? 'on' : ''}" data-w="${w.code}">${icon(w.icon, 20)}<b>${w.vi}</b><span>${w.desc}</span></button>`).join('')}</div></div>`;
  const stepSolution = () => `
    <div class="field"><label class="f" for="w-prop">Giải pháp đề xuất *</label><textarea id="w-prop" name="proposal" placeholder="Bạn muốn thay đổi điều gì? Làm như thế nào?">${esc(d.proposal)}</textarea></div>
    <div class="field"><label class="f" for="w-ben">Lợi ích mong đợi</label><textarea id="w-ben" name="expected_benefit" style="min-height:64px" placeholder="Giảm bao nhiêu phút, bao nhiêu lỗi, an toàn hơn ra sao…">${esc(d.expected_benefit)}</textarea></div>
    <div class="field"><label class="f">Công cụ Lean áp dụng</label><div class="picker">${TOOLS.map((t) => `<button type="button" class="pick ${d.lean_tool === t.code ? 'on' : ''}" data-t="${t.code}">${icon(t.icon, 20)}<b>${t.vi}</b><span>${t.tag}</span></button>`).join('')}</div></div>
    <div class="field" style="max-width:320px"><label class="f" for="w-save">Ước tính tiết kiệm mỗi năm (₫)</label><input id="w-save" name="estimated_saving" type="number" min="0" step="100000" value="${d.estimated_saving || ''}" placeholder="0"><span class="hint">Không chắc? Để trống, Ban Kaizen sẽ ước tính.</span></div>`;
  const stepReview = () => `
    <label class="drop" id="drop">${icon('camera', 32)}<div><b>Chụp hoặc chọn ảnh hiện trường (Before)</b></div><div class="small">Ảnh JPG/PNG/WEBP, video MP4. Kéo thả vào đây trên máy tính.</div>
      <input type="file" id="w-files" accept="image/*,video/*" capture="environment" multiple></label>
    <div class="previews" id="pv">${d.files.map((f, i) => `<figure>${f.type.startsWith('image/') ? `<img src="${URL.createObjectURL(f)}" alt="">` : `<span class="tag">${esc(f.name)}</span>`}<button type="button" data-rm="${i}" aria-label="Xóa ảnh">${icon('x', 12)}</button></figure>`).join('')}</div>
    <h3 style="margin-top:8px">Kiểm tra lại trước khi gửi</h3>
    <dl class="review"><dt>Tiêu đề</dt><dd data-notr><b>${esc(d.title)}</b></dd><dt>Lĩnh vực</dt><dd>${esc(cats.find((c) => c.id === +d.category_id)?.name)}</dd>
      <dt>Hiện trạng</dt><dd data-notr>${esc(d.problem)}</dd><dt>Giải pháp</dt><dd data-notr>${esc(d.proposal)}</dd>
      <dt>Lãng phí</dt><dd><div class="chips">${wasteTags(d.waste_types, 8) || '—'}</div></dd><dt>Công cụ</dt><dd>${toolTag(d.lean_tool) || '—'}</dd>
      <dt>Ước tính</dt><dd>${d.estimated_saving ? t('{v}/năm', { v: money(d.estimated_saving) }) : '—'}</dd></dl>`;

  const collect = () => { const fd = new FormData($('#wf')); for (const [key, v] of fd.entries()) if (key in d && key !== 'files') d[key] = v; };
  const bind = () => {
    $$('[data-w]').forEach((b) => (b.onclick = () => { collect(); const c = b.dataset.w; d.waste_types = d.waste_types.includes(c) ? d.waste_types.filter((x) => x !== c) : [...d.waste_types, c]; b.classList.toggle('on'); }));
    $$('[data-t]').forEach((b) => (b.onclick = () => { d.lean_tool = d.lean_tool === b.dataset.t ? '' : b.dataset.t; $$('[data-t]').forEach((x) => x.classList.toggle('on', x.dataset.t === d.lean_tool)); }));
    $('#next')?.addEventListener('click', () => {
      collect();
      if (step === 0 && (!d.title.trim() || !d.problem.trim())) return toast('Cần nhập tiêu đề và hiện trạng', 'alert');
      if (step === 1 && !d.proposal.trim()) return toast('Cần mô tả giải pháp đề xuất', 'alert');
      step++; draw(); window.scrollTo(0, 0);
    });
    $('#prev')?.addEventListener('click', () => { if (step < 2) collect(); step--; draw(); });
    const fi = $('#w-files'), drop = $('#drop');
    const addFiles = (list) => { d.files.push(...[...list].slice(0, 10)); draw(); };
    if (fi) {
      fi.onchange = () => addFiles(fi.files);
      drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
      drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); };
      $$('[data-rm]').forEach((b) => (b.onclick = () => { d.files.splice(+b.dataset.rm, 1); draw(); }));
    }
    const send = async (submit) => {
      const fields = { title: d.title, category_id: d.category_id, problem: d.problem, proposal: d.proposal, expected_benefit: d.expected_benefit,
        estimated_saving: d.estimated_saving || 0, lean_tool: d.lean_tool, waste_types: d.waste_types.join(','), submit: String(submit) };
      if (qrLine) fields.line_qr = params.get('line'); else if (d.line_id) fields.line_id = d.line_id;
      const item = { client_uuid: crypto.randomUUID(), fields, files: d.files };
      $$('.wfoot button').forEach((b) => (b.disabled = true));
      if (!navigator.onLine) { await queue(item); toast('Đang ngoại tuyến. Đã lưu, sẽ tự gửi khi có mạng', 'wifiOff'); location.hash = '#/'; return; }
      try {
        const r = await api('/kaizens', { method: 'POST', form: toForm(item) });
        toast(submit ? t('Đã gửi {code}. Tổ trưởng sẽ phản hồi trong 48 giờ', { code: r.code }) : t('Đã lưu nháp {code}', { code: r.code })); location.hash = '#/kaizen/' + r.id;
      } catch (err) {
        if (!err.status || err.status >= 500) { await queue(item); toast('Mất kết nối. Đã lưu ngoại tuyến', 'wifiOff'); location.hash = '#/'; }
        else { toast(err.message, 'alert'); $$('.wfoot button').forEach((b) => (b.disabled = false)); }
      }
    };
    $('#send')?.addEventListener('click', () => send(true));
    $('#draft')?.addEventListener('click', () => send(false));
  };
  draw();
}

// ============ analytics ============
async function viewAnalytics(_, params) {
  const period = params.get('p') || 'all';
  const from = period === 'all' ? '' : new Date(Date.now() - +period * 864e5).toISOString().slice(0, 10);
  const qs = from ? '?from=' + from : '';
  const canRoi = ['IE', 'FINANCE', 'DIRECTOR', 'ADMIN', 'LEADER'].includes(role());
  const [s, wastes, trend, roi] = await Promise.all([api('/reports/summary' + qs), api('/reports/wastes' + qs), api('/reports/trend'), canRoi ? api('/reports/roi' + qs).catch(() => []) : Promise.resolve([])]);
  const bs = Object.fromEntries(s.by_status.map((x) => [x.status, +x.total]));
  const g = (...k) => k.reduce((a, x) => a + (bs[x] || 0), 0);
  const funnel = [
    { label: t('Đã gửi'), value: s.total_ideas },
    { label: t('Qua sơ duyệt'), value: g('QUICK_WIN', 'PENDING_IE', 'IMPLEMENTING', 'PENDING_FINANCE', 'COMPLETED') },
    { label: t('Đã triển khai'), value: g('QUICK_WIN', 'IMPLEMENTING', 'PENDING_FINANCE', 'COMPLETED') },
    { label: t('Hoàn thành'), value: g('COMPLETED') },
  ];
  const months = trend.map((x) => ({ label: t('Tháng {m}/{y}', { m: x.month.slice(5), y: x.month.slice(0, 4) }), short: t('T{m}', { m: +x.month.slice(5) }), submitted: +x.submitted, completed: +x.completed }));
  const net = s.verified_saving - s.verified_investment;
  const chip = (p, l) => `<a class="chip ${period === p ? 'on' : ''}" href="#/analytics?p=${p}">${l}</a>`;

  app.innerHTML = `
    <div class="page-h"><div class="grow"><h1>Phân tích & ROI</h1><p>Hiệu quả chương trình Kaizen: số lượng, tốc độ, lãng phí được loại bỏ và giá trị tài chính đã xác thực.</p></div>
      <div class="chips">${chip('30', '30 ngày')}${chip('90', 'Quý')}${chip('365', '12 tháng')}${chip('all', 'Tất cả')}</div></div>
    <section class="grid g4" style="margin-bottom:16px">
      ${kpi('bulb', 'Sáng kiến đã gửi', s.total_ideas, t('{n} người tham gia', { n: s.participants }))}
      ${kpi('check', 'Hoàn thành', s.completed, t('{q} Quick Win · {m} dự án', { q: s.quick_wins, m: s.major_projects }))}
      ${kpi('coins', 'Tiết kiệm đã xác thực', moneyShort(s.verified_saving), t('Đầu tư {v}', { v: moneyShort(s.verified_investment) }))}
      ${kpi('trend', 'Lợi ích ròng năm đầu', moneyShort(net), s.verified_investment ? `ROI ${Math.round(net / s.verified_investment * 100)}%` : 'Chưa có dự án xác thực')}
    </section>
    <section class="grid" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr);margin-bottom:16px" id="row1">
      <div class="card"><div class="card-h"><h2>Đề xuất và hoàn thành theo tháng</h2><div class="legend"><span><i class="sw s1"></i>Đã gửi</span><span><i class="sw s2"></i>Hoàn thành</span></div></div>
        <div class="card-b">${columnChart(months, { aria: t('Đề xuất và hoàn thành theo tháng') }, [{ key: 'submitted', label: t('Đã gửi'), cls: 's1' }, { key: 'completed', label: t('Hoàn thành'), cls: 's2' }])}
        <details style="margin-top:8px"><summary class="small muted" style="cursor:pointer">Xem dạng bảng</summary><div class="table-wrap"><table><tr><th>Tháng</th><th class="r">Đã gửi</th><th class="r">Hoàn thành</th></tr>${months.map((m2) => `<tr><td>${m2.label}</td><td class="r">${m2.submitted}</td><td class="r">${m2.completed}</td></tr>`).join('')}</table></div></details></div></div>
      <div class="card"><div class="card-h"><h2>Tỷ lệ hoàn thành</h2></div><div class="card-b stack" style="align-items:center;text-align:center">
        ${ring(s.completion_rate, 132)}<p class="small muted">Tỷ lệ sáng kiến được duyệt đã hoàn thành.<br><span>Thời gian sơ duyệt trung bình</span> <b style="color:var(--ink)">${t('{h} giờ', { h: s.avg_leader_response_hours })}</b> <span>(mục tiêu 48 giờ).</span></p></div></div>
    </section>
    <section class="grid g2" style="margin-bottom:16px">
      <div class="card"><div class="card-h"><h2>Lãng phí được tấn công</h2><span class="small muted">Số sáng kiến</span></div><div class="card-b">
        ${wastes.length ? barList(wastes.map((w) => ({ ...w, label: t(WASTE[w.waste]?.vi || w.waste), value: +w.total })), { icon: (r) => icon(WASTE[r.waste]?.icon || 'alert', 14), cls: 'seq' }) : empty('chart', 'Chưa có dữ liệu', 'Hãy gắn loại lãng phí khi gửi đề xuất.')}</div></div>
      <div class="card"><div class="card-h"><h2>Phễu chuyển đổi</h2><span class="small muted">Từ ý tưởng đến kết quả</span></div><div class="card-b">${barList(funnel, { cls: 's1' })}
        <h3 style="margin:20px 0 10px">Theo lĩnh vực</h3>${barList(s.by_category.map((c) => ({ label: t(c.category), value: +c.total })), { cls: 'seq' })}</div></div>
    </section>
    ${roi.length ? `<section class="card"><div class="card-h"><h2>ROI theo xưởng và tháng</h2><span class="small muted">Chỉ gồm dự án đã được Kế toán xác thực</span></div>
      <div class="table-wrap"><table><tr><th>Tháng</th><th>Xưởng</th><th class="r">Dự án</th><th class="r">Đầu tư</th><th class="r">Tiết kiệm / năm</th><th class="r">ROI</th><th class="r">Hoàn vốn</th></tr>
      ${roi.map((x) => `<tr><td class="mono">${esc(x.month)}</td><td>${esc(x.workshop)}</td><td class="r">${x.projects}</td><td class="r">${money(x.investment)}</td><td class="r">${money(x.annual_saving)}</td><td class="r"><b style="color:var(--good)">${x.roi_percent ?? '—'}%</b></td><td class="r">${x.payback_months != null ? t('{n} tháng', { n: x.payback_months }) : '—'}</td></tr>`).join('')}</table></div></section>` : ''}`;
  if (innerWidth < 980) $('#row1').style.gridTemplateColumns = 'minmax(0,1fr)';
}

// ============ leaderboard ============
async function viewLeaderboard() {
  const [rows, m] = await Promise.all([api('/reports/leaderboard'), api('/auth/me')]);
  const mb = beltOf(m.total_points || 0), top = rows.slice(0, 3);
  const pod = (r, i) => { if (!r) return '<div></div>'; const b = beltOf(r.points); return `<div class="card pod ${i === 0 ? 'first' : ''}">
    <span class="rank">${t('HẠNG {n}', { n: i + 1 })}</span>${beltSvg(b, i === 0 ? 72 : 56)}<b data-notr>${esc(r.full_name)}</b><span class="small muted">${esc(r.workshop || t(ROLES[r.role]))}</span>
    <span class="pts">${r.points}<small class="muted" style="font-size:13px"> điểm</small></span><span class="small muted">${t('{belt} · {c}/{n} hoàn thành', { belt: t(b.vi), c: r.completed, n: r.ideas })}</span></div>`; };
  app.innerHTML = `
    <div class="page-h"><div class="grow"><h1>Bảng vàng Kaizen</h1><p>Vinh danh những người tạo ra cải tiến thực sự. Điểm chỉ được cộng khi sáng kiến hoàn thành và được xác nhận.</p></div></div>
    <section class="podium" style="margin-bottom:24px">${pod(top[1], 1)}${pod(top[0], 0)}${pod(top[2], 2)}</section>
    <section class="card" style="margin-bottom:28px"><div class="card-h"><h2>Xếp hạng</h2></div><div class="table-wrap"><table>
      <tr><th>#</th><th>Nhân viên</th><th>Cấp đai</th><th class="r">Sáng kiến</th><th class="r">Hoàn thành</th><th class="r">Thưởng</th><th class="r">Điểm</th></tr>
      ${rows.map((r, i) => { const b = beltOf(r.points); return `<tr class="${r.user_id === m.id ? 'me' : ''}"><td class="mono">${i + 1}</td>
        <td><div class="row" style="flex-wrap:nowrap">${avatar(r.full_name)}<span><b data-notr>${esc(r.full_name)}</b><br><span class="small muted">${esc(r.workshop || t(ROLES[r.role]))}</span></span></div></td>
        <td><div class="row" style="flex-wrap:nowrap;gap:6px">${beltSvg(b, 26)}<span class="small">${t(b.vi)}</span></div></td>
        <td class="r">${r.ideas}</td><td class="r">${r.completed}</td><td class="r">${r.amount ? money(r.amount) : '—'}</td><td class="r"><b>${r.points}</b></td></tr>`; }).join('')}</table></div></section>
    <section><div class="eyebrow">Lộ trình phát triển</div><h2 style="margin:4px 0 4px;font-size:22px">5 cấp đai Kaizen</h2><p class="muted" style="margin-bottom:16px">Mô phỏng hệ thống đai Lean Six Sigma: điểm cải tiến tích lũy quyết định cấp đai của bạn.</p>
      <div class="belts">${BELTS.map((b, i) => `<div class="card beltstep ${i === mb.index ? 'me' : ''}"><div class="row">${beltSvg(b, 48)}<span class="grow"></span>${i === mb.index ? '<span class="pill t-good">Bạn ở đây</span>' : ''}</div>
        <span class="lvl">${t('Cấp {n} · từ {p} điểm', { n: i + 1, p: b.min })}</span><h3>${t(b.vi)}</h3><p>${t(b.desc)}</p><span class="small" style="font-weight:700;color:var(--brand)">${t(b.step)}</span></div>`).join('')}</div></section>`;
}

// ============ academy ============
function viewAcademy() {
  app.innerHTML = `
    <div class="page-h"><div class="grow"><h1>Học viện Lean</h1><p>Kiến thức nền tảng để nhìn ra lãng phí và đề xuất cải tiến tốt hơn. Mỗi mục đều dẫn thẳng đến form đề xuất.</p></div></div>
    <nav class="acad-nav chips"><a class="chip" href="#principles" data-jump="principles">10 nguyên tắc</a><a class="chip" href="#wastes" data-jump="wastes">8 lãng phí</a><a class="chip" href="#tools" data-jump="tools">Công cụ Lean</a><a class="chip" href="#belts" data-jump="belts">Lộ trình đai</a></nav>
    <section class="acad-sec" id="principles"><div class="eyebrow">Tư duy</div><h2>10 nguyên tắc Kaizen xây dựng hệ thống tốt hơn</h2><p>Kaizen (改善) nghĩa là "thay đổi để tốt hơn". Đây là những nguyên tắc giúp cải tiến trở thành thói quen hằng ngày.</p>
      <div class="principles">${PRINCIPLES.map(([ic, t, d2], i) => `<div class="card prin"><span class="p-n">${String(i + 1).padStart(2, '0')}</span><span class="p-ic">${icon(ic, 22)}</span><h3>${t}</h3><p>${d2}</p></div>`).join('')}</div></section>
    <section class="acad-sec" id="wastes"><div class="eyebrow">Nhận diện</div><h2>8 lãng phí trong Lean (DOWNTIME)</h2><p>Mọi hoạt động không tạo giá trị cho khách hàng là lãng phí. Tập trung vào giá trị, loại bỏ phần không tạo giá trị.</p>
      <div class="wastes">${WASTES.map((w) => `<div class="card waste"><div class="w-h"><span class="w-ic">${icon(w.icon, 22)}</span><div><b>${t(w.vi)}</b><span>${w.en}</span></div></div><p class="small">${w.desc}</p>
        <p class="ex"><b>Ví dụ:</b> ${t(w.example)}</p><a class="small" style="font-weight:700" href="#/new?waste=${w.code}">Đề xuất loại bỏ ${icon('arrowR', 14)}</a></div>`).join('')}</div></section>
    <section class="acad-sec" id="tools"><div class="eyebrow">Phương pháp</div><h2>Công cụ Lean tại nơi làm việc</h2><p>Công cụ thông minh hơn, nơi làm việc tốt hơn, cải tiến liên tục.</p>
      <div class="tools">${GEMBA_TOOLS.map(([ic, t, tag, d2]) => `<div class="card tool"><div class="t-h"><span class="t-ic">${icon(ic, 22)}</span><div><span>${tag}</span><b>${t}</b></div></div><p class="small">${d2}</p></div>`).join('')}
        ${TOOLS.filter((t) => t.code !== 'OTHER').map((t) => `<div class="card tool"><div class="t-h"><span class="t-ic">${icon(t.icon, 22)}</span><div><span>${t.tag}</span><b>${t.vi}</b></div></div><p class="small">${t.desc}</p><ul>${t.points.map((p) => `<li>${p}</li>`).join('')}</ul></div>`).join('')}</div></section>
    <section class="acad-sec" id="belts"><div class="eyebrow">Phát triển</div><h2>Hành trình đai Kaizen</h2><p>Học nền tảng → Hỗ trợ quy trình → Thực hành & cải tiến → Dẫn dắt & kèm cặp → Chiến lược & chuyển đổi.</p>
      <div class="belts">${BELTS.map((b, i) => `<div class="card beltstep">${beltSvg(b, 48)}<span class="lvl">${t('Bước {n}', { n: i + 1 })}</span><h3>${t(b.step)}</h3><p>${t(b.vi)}: ${t(b.desc)}</p></div>`).join('')}</div></section>
    <div class="card motto"><b>Thay đổi nhỏ hôm nay. Hệ thống mạnh hơn ngày mai.</b><span>Tiếp tục cải tiến, tiếp tục phát triển.</span><p style="margin-top:14px"><a class="btn" href="#/new">${icon('camera', 18)}Đề xuất cải tiến</a></p></div>`;
  $$('[data-jump]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); document.getElementById(a.dataset.jump).scrollIntoView({ behavior: 'smooth' }); }));
}

// ============ admin ============
async function viewAdmin() {
  if (role() !== 'ADMIN') { app.innerHTML = `<div class="card">${empty('shield', 'Chỉ dành cho quản trị viên', 'Bạn không có quyền truy cập trang này.')}</div>`; return; }
  const [users, master] = await Promise.all([api('/admin/users'), api('/master')]);
  const ws = Object.fromEntries(master.workshops.map((w) => [w.id, w]));
  const base = location.href.split('#')[0];
  app.innerHTML = `
    <div class="page-h"><div class="grow"><h1>Quản trị hệ thống</h1><p>Người dùng, phân quyền và mã QR cho từng dây chuyền.</p></div></div>
    <section class="grid" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr);margin-bottom:16px" id="adm1">
      <div class="card"><div class="card-h"><h2>Người dùng</h2><span class="muted small">${t('{n} tài khoản', { n: users.length })}</span></div><div class="table-wrap"><table>
        <tr><th>Mã</th><th>Họ tên</th><th>Vai trò</th><th>Xưởng</th><th>Trạng thái</th></tr>
        ${users.map((x) => `<tr><td class="mono">${esc(x.employee_code)}</td><td data-notr>${esc(x.full_name)}</td><td>${esc(t(ROLES[x.role] || x.role))}</td><td>${esc(ws[x.workshop_id]?.name || '—')}</td><td>${x.is_active === false ? '<span class="pill t-bad">Khóa</span>' : '<span class="pill t-good">Hoạt động</span>'}</td></tr>`).join('')}</table></div></div>
      <form class="card pad stack" id="nu" style="gap:10px"><h2>Thêm người dùng</h2>
        <div class="field"><label class="f" for="nu-code">Mã nhân viên</label><input id="nu-code" name="employee_code" required></div>
        <div class="field"><label class="f" for="nu-name">Họ tên</label><input id="nu-name" name="full_name" required></div>
        <div class="field"><label class="f" for="nu-role">Vai trò</label><select id="nu-role" name="role">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}">${t(v)}</option>`).join('')}</select></div>
        <div class="field"><label class="f" for="nu-ws">Xưởng</label><select id="nu-ws" name="workshop_id"><option value="">—</option>${master.workshops.map((w) => `<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select></div>
        <div class="field"><label class="f" for="nu-pw">Mật khẩu ban đầu</label><input id="nu-pw" name="password" type="text" minlength="6" required value="123456"></div>
        <button class="btn">${icon('plus', 16)}Tạo tài khoản</button></form>
    </section>
    <section class="card"><div class="card-h"><h2>Dây chuyền & mã QR</h2><span class="muted small">In mã QR dán tại chuyền. Công nhân quét là mở form đề xuất đúng vị trí.</span></div><div class="table-wrap"><table>
      <tr><th>Mã</th><th>Dây chuyền</th><th>Xưởng</th><th>Liên kết QR</th><th></th></tr>
      ${master.lines.map((l) => `<tr><td class="mono">${esc(l.code)}</td><td>${esc(l.name)}</td><td>${esc(ws[l.workshop_id]?.name)}</td><td class="mono small" style="max-width:320px;overflow-wrap:anywhere">${esc(base)}#/new?line=${esc(l.qr_token)}</td>
        <td><button class="btn ghost sm" data-copy="${esc(base)}#/new?line=${esc(l.qr_token)}">${icon('copy', 14)}Sao chép</button></td></tr>`).join('')}</table></div>
      <form class="card-b row" id="nl" style="border-top:1px solid var(--line-2)"><select name="parent_id" style="width:auto" aria-label="Xưởng">${master.workshops.map((w) => `<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select>
        <input name="code" placeholder="Mã (VD: L03)" required style="width:140px" aria-label="Mã dây chuyền"><input name="name" placeholder="Tên dây chuyền" required class="grow" style="flex:1 1 180px" aria-label="Tên dây chuyền"><button class="btn">${icon('plus', 16)}Thêm chuyền</button></form></section>`;
  if (innerWidth < 980) $('#adm1').style.gridTemplateColumns = 'minmax(0,1fr)';
  $('#nu').onsubmit = async (e) => {
    e.preventDefault(); const v = Object.fromEntries(new FormData(e.target));
    v.workshop_id = v.workshop_id ? +v.workshop_id : null; v.factory_id = master.factories[0]?.id ?? null;
    try { await api('/admin/users', { method: 'POST', body: v }); toast(t('Đã tạo tài khoản {code}', { code: v.employee_code })); viewAdmin(); } catch (err) { toast(err.message, 'alert'); }
  };
  $('#nl').onsubmit = async (e) => {
    e.preventDefault(); const v = Object.fromEntries(new FormData(e.target)); v.parent_id = +v.parent_id;
    try { await api('/admin/lines', { method: 'POST', body: v }); toast('Đã thêm dây chuyền'); viewAdmin(); } catch (err) { toast(err.message, 'alert'); }
  };
  $$('[data-copy]').forEach((b) => (b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Đã sao chép liên kết'); }
    catch { const td = b.closest('tr').children[3]; const r = document.createRange(); r.selectNodeContents(td); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Hãy nhấn Ctrl+C để sao chép', 'copy'); }
  }));
}

// ============ boot ============
if (!DEMO && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
startAutoTranslate();
updateNet();
render();
sync(synced);
setInterval(() => sync(synced), 30000);
