// In-browser mock backend for the static demo (GitHub Pages / Artifact).
// Implements the same /api/v1 contract as the Go API, persisted in localStorage.
// Enabled only when window.KAIZEN_DEMO is true.

const KEY = 'kz_demo_db_v1';
const now = () => new Date().toISOString();
const daysAgo = (d, h = 0) => new Date(Date.now() - d * 864e5 - h * 36e5).toISOString();

const PIXEL = (color) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="${color}"/><text x="160" y="130" font-size="22" text-anchor="middle" fill="#fff" font-family="sans-serif">ẢNH MẪU</text></svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
};

function seed() {
  const users = [
    { id: 1, employee_code: 'admin', full_name: 'Quản trị hệ thống', role: 'ADMIN', factory_id: null, workshop_id: null, line_id: null },
    { id: 2, employee_code: 'CN001', full_name: 'Nguyễn Văn Công', role: 'WORKER', factory_id: 1, workshop_id: 1, line_id: 1 },
    { id: 3, employee_code: 'TT001', full_name: 'Trần Thị Thu', role: 'LEADER', factory_id: 1, workshop_id: 1, line_id: null },
    { id: 4, employee_code: 'IE001', full_name: 'Lê Văn Hải', role: 'IE', factory_id: 1, workshop_id: null, line_id: null },
    { id: 5, employee_code: 'KT001', full_name: 'Phạm Thị Lan', role: 'FINANCE', factory_id: 1, workshop_id: null, line_id: null },
    { id: 6, employee_code: 'GD001', full_name: 'Võ Minh Đức', role: 'DIRECTOR', factory_id: 1, workshop_id: null, line_id: null },
    { id: 7, employee_code: 'CN002', full_name: 'Đỗ Thị Mai', role: 'WORKER', factory_id: 1, workshop_id: 1, line_id: 2 },
  ];
  const db = {
    seq: { idea: 6, att: 10, ap: 20, task: 10, rw: 5, code: 6 },
    users,
    categories: [['SAFETY', 'An toàn'], ['QUALITY', 'Chất lượng'], ['COST', 'Chi phí'], ['DELIVERY', 'Giao hàng / Năng suất'], ['5S', '5S / Môi trường làm việc'], ['OTHER', 'Khác']]
      .map(([code, name], i) => ({ id: i + 1, code, name })),
    factories: [{ id: 1, code: 'F1', name: 'Nhà máy Tây Ninh' }],
    workshops: [{ id: 1, factory_id: 1, code: 'WS-A', name: 'Xưởng May A' }, { id: 2, factory_id: 1, code: 'WS-B', name: 'Xưởng Cắt B' }],
    lines: [{ id: 1, workshop_id: 1, code: 'L01', name: 'Chuyền 01', qr_token: 'demo-line-01' },
      { id: 2, workshop_id: 1, code: 'L02', name: 'Chuyền 02', qr_token: 'demo-line-02' },
      { id: 3, workshop_id: 2, code: 'C01', name: 'Bàn cắt 01', qr_token: 'demo-line-03' }],
    ideas: [], attachments: [], approvals: [], tasks: [], financials: [], rewards: [],
  };
  const idea = (id, o) => db.ideas.push({ id, code: `KZ-2026-${String(id).padStart(6, '0')}`, expected_benefit: null, line_id: 1,
    factory_id: 1, workshop_id: 1, kaizen_type: null, assignee_id: null, estimated_saving: 0, completed_at: null, ...o, updated_at: o.created_at });
  const ap = (id, idea_id, level, status, acted_by, comment, created_at, acted_at) =>
    db.approvals.push({ id, idea_id, level, approver_role: level, workshop_id: level === 'LEADER' ? 1 : null, status, acted_by, comment, created_at, acted_at });

  idea(1, { title: 'Gắn nam châm giữ kéo tại bàn may', category_id: 5, submitter_id: 2, status: 'COMPLETED', kaizen_type: 'QUICK_WIN', assignee_id: 2,
    problem: 'Kéo thường rơi xuống sàn, mất 5–10 giây tìm mỗi lần.', proposal: 'Gắn dải nam châm cạnh bàn để giữ kéo.', estimated_saving: 6000000,
    created_at: daysAgo(20), submitted_at: daysAgo(20), completed_at: daysAgo(19) });
  ap(1, 1, 'LEADER', 'APPROVED', 3, 'Làm ngay', daysAgo(20), daysAgo(19, 20));
  db.rewards.push({ id: 1, idea_id: 1, user_id: 2, points: 10, amount: 0, reason: 'QUICK_WIN_COMPLETED', status: 'GRANTED', created_at: daysAgo(19) });

  idea(2, { title: 'Băng tải cấp bán thành phẩm tự động', category_id: 3, submitter_id: 7, status: 'COMPLETED', kaizen_type: 'MAJOR', assignee_id: 4,
    problem: 'Công nhân phải đi lấy bán thành phẩm, mất ~40 phút/ca.', proposal: 'Lắp băng tải mini nối khu cắt và chuyền 02.', estimated_saving: 120000000,
    line_id: 2, created_at: daysAgo(45), submitted_at: daysAgo(45), completed_at: daysAgo(6) });
  ap(2, 2, 'LEADER', 'APPROVED', 3, null, daysAgo(45), daysAgo(44, 18));
  ap(3, 2, 'IE', 'APPROVED', 4, 'Khả thi, giao IE theo dõi', daysAgo(44), daysAgo(43));
  ap(4, 2, 'FINANCE', 'APPROVED', 5, 'Đã đối chiếu hóa đơn và năng suất 4 tuần', daysAgo(8), daysAgo(6));
  db.financials.push({ idea_id: 2, investment_cost: 30000000, annual_saving: 90000000, currency: 'VND', verified: true, verified_at: daysAgo(6), note: null });
  db.tasks.push({ id: 1, idea_id: 2, title: 'Khảo sát mặt bằng', status: 'DONE', assignee_id: 4, due_date: null, position: 1 },
    { id: 2, idea_id: 2, title: 'Lắp đặt băng tải', status: 'DONE', assignee_id: 4, due_date: null, position: 2 });
  db.rewards.push({ id: 2, idea_id: 2, user_id: 7, points: 50, amount: 900000, reason: 'MAJOR_PROJECT_COMPLETED', status: 'GRANTED', created_at: daysAgo(6) });

  idea(3, { title: 'Đồ gá định vị túi áo', category_id: 2, submitter_id: 2, status: 'IMPLEMENTING', kaizen_type: 'MAJOR', assignee_id: 4,
    problem: 'Tỷ lệ lỗi lệch túi 3,2%.', proposal: 'Làm đồ gá mica định vị túi.', estimated_saving: 45000000, created_at: daysAgo(10), submitted_at: daysAgo(10) });
  ap(5, 3, 'LEADER', 'APPROVED', 3, null, daysAgo(10), daysAgo(9, 20));
  ap(6, 3, 'IE', 'APPROVED', 4, 'Thử nghiệm trên chuyền 01', daysAgo(9), daysAgo(8));
  db.financials.push({ idea_id: 3, investment_cost: 5000000, annual_saving: 45000000, currency: 'VND', verified: false, verified_at: null, note: null });
  db.tasks.push({ id: 3, idea_id: 3, title: 'Thiết kế bản vẽ đồ gá', status: 'DONE', assignee_id: 4, due_date: null, position: 1 },
    { id: 4, idea_id: 3, title: 'Gia công mica', status: 'IN_PROGRESS', assignee_id: 4, due_date: '2026-11-10', position: 2 },
    { id: 5, idea_id: 3, title: 'Đào tạo công nhân chuyền 01', status: 'TODO', assignee_id: 3, due_date: '2026-11-15', position: 3 });

  idea(4, { title: 'Sơn vạch lối đi xe đẩy', category_id: 1, submitter_id: 7, status: 'PENDING_LEADER', line_id: 2,
    problem: 'Xe đẩy và người đi chung lối, có nguy cơ va chạm.', proposal: 'Sơn vạch vàng phân làn lối đi.', estimated_saving: 0, created_at: daysAgo(1), submitted_at: daysAgo(1) });
  ap(7, 4, 'LEADER', 'PENDING', null, null, daysAgo(1), null);

  idea(5, { title: 'Thay bóng đèn LED khu kiểm hàng', category_id: 3, submitter_id: 2, status: 'PENDING_IE', kaizen_type: 'MAJOR',
    problem: 'Đèn huỳnh quang tốn điện và thiếu sáng.', proposal: 'Thay 40 bóng LED 18W.', estimated_saving: 24000000, created_at: daysAgo(3), submitted_at: daysAgo(3) });
  ap(8, 5, 'LEADER', 'APPROVED', 3, null, daysAgo(3), daysAgo(2, 12));
  ap(9, 5, 'IE', 'PENDING', null, null, daysAgo(2, 12), null);

  idea(6, { title: 'Dùng thùng nhựa thay bao tải', category_id: 6, submitter_id: 2, status: 'REJECTED',
    problem: 'Bao tải dễ rách.', proposal: 'Dùng thùng nhựa.', estimated_saving: 0, created_at: daysAgo(15), submitted_at: daysAgo(15) });
  ap(10, 6, 'LEADER', 'REJECTED', 3, 'Trùng với dự án 5S của xưởng đã triển khai', daysAgo(15), daysAgo(14, 20));

  const colors = ['#5b7f73', '#7d6a55', '#4e6a8a'];
  [[1, 1, 'BEFORE'], [2, 1, 'AFTER'], [3, 2, 'BEFORE'], [4, 2, 'AFTER'], [5, 3, 'BEFORE'], [6, 4, 'BEFORE'], [7, 5, 'BEFORE']]
    .forEach(([id, idea_id, phase], i) => db.attachments.push({ id, idea_id, phase, file_name: `anh-${id}.svg`, content_type: 'image/svg+xml',
      size_bytes: 1000, data: PIXEL(colors[i % 3]), created_at: daysAgo(5) }));
  return db;
}

let db;
function load() {
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
  if (!db) db = seed();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* quota: keep in memory */ } }
export function resetDemo() { db = seed(); save(); }

class HttpErr extends Error { constructor(s, m) { super(m); this.status = s; } }
const err = (s, m) => { throw new HttpErr(s, m); };
const user = (id) => db.users.find((u) => u.id === id);
const nameOf = (id) => user(id)?.full_name ?? null;
const ideaOf = (id) => db.ideas.find((i) => i.id === +id) || err(404, 'not found');

function canView(c, i) {
  if (i.submitter_id === c.id || i.assignee_id === c.id) return true;
  if (c.role === 'WORKER') return false;
  if (c.role === 'LEADER') return c.workshop_id === i.workshop_id;
  return true;
}

function toDataURL(file) {
  return new Promise((ok) => {
    if (!file.type.startsWith('image/')) { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(file); return; }
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, 800 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
      cv.width = img.width * s; cv.height = img.height * s;
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url); ok(cv.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => ok(PIXEL('#888'));
    img.src = url;
  });
}

async function addFiles(ideaId, uid, phase, files) {
  for (const f of files) {
    if (!f || !f.size) continue;
    db.attachments.push({ id: ++db.seq.att, idea_id: ideaId, phase, file_name: f.name, content_type: f.type.startsWith('image/') ? 'image/jpeg' : f.type,
      size_bytes: f.size, data: await toDataURL(f), created_at: now() });
  }
}

function grant(i, by) {
  if (db.rewards.some((r) => r.idea_id === i.id)) return;
  const fin = db.financials.find((f) => f.idea_id === i.id && f.verified);
  const major = i.kaizen_type === 'MAJOR';
  db.rewards.push({ id: ++db.seq.rw, idea_id: i.id, user_id: i.submitter_id, points: major ? 50 : 10,
    amount: major && fin ? Math.round(fin.annual_saving * 0.01) : 0, reason: major ? 'MAJOR_PROJECT_COMPLETED' : 'QUICK_WIN_COMPLETED', status: 'GRANTED', created_at: now(), granted_by: by });
}

const finView = (f) => f && ({ ...f, roi_percent: f.investment_cost > 0 ? Math.round((f.annual_saving - f.investment_cost) / f.investment_cost * 10000) / 100 : null,
  payback_months: f.annual_saving > 0 ? Math.round(f.investment_cost / f.annual_saving * 1200) / 100 : null });

function upsertFin(id, inv, sav, verify) {
  let f = db.financials.find((x) => x.idea_id === id);
  if (!f) { f = { idea_id: id, investment_cost: 0, annual_saving: 0, currency: 'VND', verified: false, verified_at: null }; db.financials.push(f); }
  if (inv != null) f.investment_cost = +inv;
  if (sav != null) f.annual_saving = +sav;
  if (verify) { f.verified = true; f.verified_at = now(); }
}

function listRow(i) {
  const thumb = db.attachments.find((a) => a.idea_id === i.id && a.content_type.startsWith('image/'));
  return { ...i, category: db.categories.find((c) => c.id === i.category_id)?.name, workshop: db.workshops.find((w) => w.id === i.workshop_id)?.name,
    line: db.lines.find((l) => l.id === i.line_id)?.name ?? null, submitter: nameOf(i.submitter_id), assignee: nameOf(i.assignee_id), thumb_id: thumb?.id ?? null };
}

function pendingFor(c) {
  return db.approvals.filter((a) => a.status === 'PENDING' && (c.role === 'ADMIN'
    || (c.role === 'LEADER' && a.level === 'LEADER' && a.workshop_id === c.workshop_id)
    || (['IE', 'FINANCE'].includes(c.role) && a.approver_role === c.role)));
}

async function handle(method, path, body, c) {
  const p = path.split('?')[0].split('/').filter(Boolean);
  const q = new URLSearchParams(path.split('?')[1] || '');
  const r = `${method} /${p.map((s) => (/^\d+$/.test(s) ? ':id' : s)).join('/')}`;
  const id = +p.find((s) => /^\d+$/.test(s));
  const field = (k) => (body instanceof FormData ? body.get(k) : body?.[k]);

  switch (r) {
    case 'POST /auth/login': {
      const u = db.users.find((x) => x.employee_code === String(field('employee_code')).trim());
      if (!u) err(401, 'Sai mã nhân viên. Chọn một tài khoản demo bên dưới.');
      return { token: 'demo:' + u.id, user: { uid: u.id, role: u.role, fid: u.factory_id, wid: u.workshop_id, name: u.full_name } };
    }
    case 'GET /auth/me':
      return { ...c, total_points: db.rewards.filter((x) => x.user_id === c.id).reduce((s, x) => s + x.points, 0) };
    case 'GET /me/rewards':
      return db.rewards.filter((x) => x.user_id === c.id).map((x) => ({ ...x, code: ideaOf(x.idea_id).code, title: ideaOf(x.idea_id).title }));
    case 'GET /categories': return db.categories;
    case 'GET /master': return { factories: db.factories, workshops: db.workshops, lines: db.lines };
    case 'GET /lines/qr/' + p[2]: {
      const l = db.lines.find((x) => x.qr_token === p[2]) || err(404, 'line not found');
      return { ...l, workshop_name: db.workshops.find((w) => w.id === l.workshop_id).name };
    }
    case 'GET /kaizens': {
      const st = q.get('status');
      const items = db.ideas.filter((i) => canView(c, i) && (!st || st.split(',').includes(i.status)))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).map(listRow);
      return { items, page: 1, page_size: 50, total: items.length };
    }
    case 'POST /kaizens': {
      const title = String(field('title') || '').trim(), problem = String(field('problem') || '').trim(), proposal = String(field('proposal') || '').trim();
      if (!title || !problem || !proposal || !+field('category_id')) err(400, 'Cần nhập tiêu đề, hiện trạng, giải pháp và lĩnh vực');
      const cu = field('client_uuid');
      const dup = cu && db.ideas.find((i) => i.client_uuid === cu);
      if (dup) return { id: dup.id, duplicate: true };
      const line = db.lines.find((l) => l.qr_token === field('line_qr') || l.id === +field('line_id')) || db.lines.find((l) => l.id === c.line_id) || db.lines[0];
      const i = { id: ++db.seq.idea, code: `KZ-2026-${String(++db.seq.code).padStart(6, '0')}`, client_uuid: cu, title, problem, proposal,
        expected_benefit: field('expected_benefit') || null, category_id: +field('category_id'), submitter_id: c.id, factory_id: 1,
        workshop_id: line.workshop_id, line_id: line.id, kaizen_type: null, status: 'DRAFT', assignee_id: null,
        estimated_saving: +field('estimated_saving') || 0, submitted_at: null, completed_at: null, created_at: now(), updated_at: now() };
      db.ideas.push(i);
      if (body instanceof FormData) await addFiles(i.id, c.id, 'BEFORE', body.getAll('before'));
      if (String(field('submit')) === 'true') submit(i);
      return { id: i.id, code: i.code, status: i.status };
    }
    case 'GET /kaizens/:id': {
      const i = ideaOf(id);
      if (!canView(c, i)) err(403, 'forbidden');
      return { ...listRow(i), attachments: db.attachments.filter((a) => a.idea_id === i.id),
        approvals: db.approvals.filter((a) => a.idea_id === i.id).map((a) => ({ ...a, acted_by: nameOf(a.acted_by) })),
        tasks: db.tasks.filter((t) => t.idea_id === i.id).sort((a, b) => a.position - b.position).map((t) => ({ ...t, assignee: nameOf(t.assignee_id) })),
        rewards: db.rewards.filter((x) => x.idea_id === i.id).map((x) => ({ ...x, full_name: nameOf(x.user_id) })),
        financials: finView(db.financials.find((f) => f.idea_id === i.id)) || null };
    }
    case 'POST /kaizens/:id/submit': {
      const i = ideaOf(id);
      if (i.submitter_id !== c.id) err(403, 'Chỉ người đề xuất được gửi duyệt');
      submit(i); return { status: i.status };
    }
    case 'POST /kaizens/:id/attachments': {
      const i = ideaOf(id);
      if (!canView(c, i)) err(403, 'forbidden');
      await addFiles(i.id, c.id, String(body.get('phase')).toUpperCase(), body.getAll('files'));
      return { uploaded: body.getAll('files').length };
    }
    case 'POST /kaizens/:id/complete': {
      const i = ideaOf(id), owner = i.assignee_id === c.id;
      const after = db.attachments.some((a) => a.idea_id === i.id && a.phase === 'AFTER');
      if (i.status === 'QUICK_WIN') {
        if (!(owner || ['LEADER', 'ADMIN'].includes(c.role))) err(403, 'forbidden');
        if (!after) err(422, 'Cần tải ít nhất một ảnh After trước khi hoàn thành');
        i.status = 'COMPLETED'; i.completed_at = now(); grant(i, c.id);
      } else if (i.status === 'IMPLEMENTING') {
        if (!(owner || ['IE', 'ADMIN'].includes(c.role))) err(403, 'forbidden');
        const open = db.tasks.filter((t) => t.idea_id === i.id && t.status !== 'DONE').length;
        if (open) err(422, `Còn ${open} công việc chưa DONE`);
        if (!after) err(422, 'Cần tải ít nhất một ảnh After trước khi hoàn thành');
        i.status = 'PENDING_FINANCE';
        db.approvals.push({ id: ++db.seq.ap, idea_id: i.id, level: 'FINANCE', approver_role: 'FINANCE', status: 'PENDING', created_at: now() });
      } else err(409, 'Không thể hoàn thành ở trạng thái ' + i.status);
      return { status: i.status };
    }
    case 'PUT /kaizens/:id/financials':
      if (!['IE', 'FINANCE', 'ADMIN'].includes(c.role)) err(403, 'forbidden');
      upsertFin(ideaOf(id).id, body.investment_cost, body.annual_saving, false); return { ok: true };
    case 'GET /approvals/pending':
      return pendingFor(c).map((a) => { const i = listRow(ideaOf(a.idea_id));
        return { approval_id: a.id, level: a.level, pending_since: a.created_at, idea_id: i.id, code: i.code, title: i.title, status: i.status,
          estimated_saving: i.estimated_saving, workshop: i.workshop, submitter: i.submitter, category: i.category,
          waiting_hours: Math.round((Date.now() - new Date(a.created_at)) / 36e5) }; });
    case 'POST /approvals/:id/action': {
      const a = db.approvals.find((x) => x.id === id) || err(404, 'approval not found');
      if (a.status !== 'PENDING') err(409, 'Đã được xử lý');
      if (!pendingFor(c).includes(a)) err(403, 'Bạn không có quyền duyệt cấp này');
      const action = String(body.action).toUpperCase();
      if (action !== 'APPROVE' && !String(body.comment || '').trim()) err(400, 'Cần nhập lý do khi từ chối hoặc yêu cầu sửa');
      const i = ideaOf(a.idea_id);
      let next;
      if (action === 'REJECT') next = 'REJECTED';
      else if (action === 'REVISION') next = a.level === 'FINANCE' ? 'IMPLEMENTING' : 'REVISION_REQUESTED';
      else if (a.level === 'LEADER') {
        if (body.kaizen_type === 'QUICK_WIN') { next = 'QUICK_WIN'; i.kaizen_type = 'QUICK_WIN'; i.assignee_id = i.submitter_id; }
        else if (body.kaizen_type === 'MAJOR') { next = 'PENDING_IE'; i.kaizen_type = 'MAJOR';
          db.approvals.push({ id: ++db.seq.ap, idea_id: i.id, level: 'IE', approver_role: 'IE', status: 'PENDING', created_at: now() }); }
        else err(400, 'Chọn Quick Win hoặc Dự án lớn');
      } else if (a.level === 'IE') { next = 'IMPLEMENTING'; i.assignee_id = body.assignee_id || 4; }
      else { upsertFin(i.id, body.investment_cost, body.annual_saving, true); next = 'COMPLETED'; }
      Object.assign(a, { status: { APPROVE: 'APPROVED', REJECT: 'REJECTED', REVISION: 'REVISION' }[action], acted_by: c.id, comment: body.comment || null, acted_at: now() });
      i.status = next; i.updated_at = now();
      if (next === 'COMPLETED') { i.completed_at = now(); grant(i, c.id); }
      return { status: next };
    }
    case 'POST /kaizens/:id/tasks': {
      const i = ideaOf(id);
      if (!String(body.title || '').trim()) err(400, 'Cần nhập tên công việc');
      db.tasks.push({ id: ++db.seq.task, idea_id: i.id, title: body.title.trim(), status: 'TODO', assignee_id: null, due_date: body.due_date || null,
        position: db.tasks.filter((t) => t.idea_id === i.id).length + 1 });
      return { id: db.seq.task };
    }
    case 'PATCH /kaizens/tasks/:id/status': {
      const t = db.tasks.find((x) => x.id === id) || err(404, 'task not found');
      t.status = String(body.status).toUpperCase(); return { status: t.status };
    }
    case 'GET /reports/summary': {
      const v = db.ideas.filter((i) => canView(c, i)), sub = v.filter((i) => i.status !== 'DRAFT');
      const cnt = (f) => v.filter(f).length, done = cnt((i) => i.status === 'COMPLETED');
      const active = cnt((i) => !['DRAFT', 'REJECTED'].includes(i.status));
      const fin = db.financials.filter((f) => f.verified && v.some((i) => i.id === f.idea_id));
      const leaderHrs = db.approvals.filter((a) => a.level === 'LEADER' && a.acted_at).map((a) => (new Date(a.acted_at) - new Date(a.created_at)) / 36e5);
      const byCat = {}; sub.forEach((i) => { const n = listRow(i).category; byCat[n] = (byCat[n] || 0) + 1; });
      const top = {}; db.rewards.forEach((x) => { const u = user(x.user_id); const k = u.full_name;
        top[k] ??= { full_name: k, workshop: db.workshops.find((w) => w.id === u.workshop_id)?.name, points: 0, ideas: 0 }; top[k].points += x.points; top[k].ideas++; });
      return { total_ideas: sub.length, completed: done, rejected: cnt((i) => i.status === 'REJECTED'),
        pending_approval: cnt((i) => i.status.startsWith('PENDING')), in_progress: cnt((i) => ['QUICK_WIN', 'IMPLEMENTING'].includes(i.status)),
        quick_wins: cnt((i) => i.kaizen_type === 'QUICK_WIN'), major_projects: cnt((i) => i.kaizen_type === 'MAJOR'),
        completion_rate: active ? Math.round(done / active * 1000) / 10 : 0,
        estimated_saving: v.filter((i) => i.status !== 'REJECTED').reduce((s, i) => s + i.estimated_saving, 0),
        verified_saving: fin.reduce((s, f) => s + f.annual_saving, 0), verified_investment: fin.reduce((s, f) => s + f.investment_cost, 0),
        avg_leader_response_hours: leaderHrs.length ? Math.round(leaderHrs.reduce((a, b) => a + b, 0) / leaderHrs.length * 10) / 10 : 0,
        participants: new Set(sub.map((i) => i.submitter_id)).size,
        by_category: Object.entries(byCat).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
        top_contributors: Object.values(top).sort((a, b) => b.points - a.points) };
    }
    case 'GET /reports/roi': {
      const g = {};
      db.ideas.filter((i) => i.status === 'COMPLETED').forEach((i) => {
        const f = db.financials.find((x) => x.idea_id === i.id && x.verified); if (!f) return;
        const month = i.completed_at.slice(0, 7), w = listRow(i).workshop, k = month + w;
        g[k] ??= { month, workshop: w, projects: 0, investment: 0, annual_saving: 0 };
        g[k].projects++; g[k].investment += f.investment_cost; g[k].annual_saving += f.annual_saving;
      });
      return Object.values(g).map((x) => ({ ...x, roi_percent: x.investment ? Math.round((x.annual_saving - x.investment) / x.investment * 10000) / 100 : null,
        payback_months: x.annual_saving ? Math.round(x.investment / x.annual_saving * 1200) / 100 : null }));
    }
  }
  err(404, 'Endpoint không có trong bản demo');
}

function submit(i) {
  if (!['DRAFT', 'REVISION_REQUESTED'].includes(i.status)) err(409, 'Không thể gửi duyệt ở trạng thái ' + i.status);
  i.status = 'PENDING_LEADER'; i.submitted_at ??= now();
  db.approvals.push({ id: ++db.seq.ap, idea_id: i.id, level: 'LEADER', approver_role: 'LEADER', workshop_id: i.workshop_id, status: 'PENDING', created_at: now() });
}

export async function mockApi(path, { method = 'GET', body, form } = {}, token) {
  if (!db) load();
  const c = token ? user(+String(token).split(':')[1]) : null;
  if (!c && path !== '/auth/login') err(401, 'missing token');
  const snapshot = JSON.stringify(db);
  try {
    const res = await handle(method, path, form || body, c);
    save();
    return JSON.parse(JSON.stringify(res ?? {}));
  } catch (e) {
    db = JSON.parse(snapshot); // roll back partial changes, like a DB transaction
    throw e;
  }
}

export function mockFileUrl(id) {
  if (!db) load();
  return db.attachments.find((a) => a.id === +id)?.data || '';
}
