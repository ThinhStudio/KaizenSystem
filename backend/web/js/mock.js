// In-browser mock backend for the static demo (GitHub Pages / Artifact).
// Implements the same /api/v1 contract as the Go API, persisted in localStorage.
// Enabled only when window.KAIZEN_DEMO is true.

const KEY = 'kz_demo_db_v2';
const now = () => new Date().toISOString();
const daysAgo = (d, h = 0) => new Date(Date.now() - d * 864e5 - h * 36e5).toISOString();

const PIXEL = (color, label = 'ẢNH MẪU') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300"><defs><pattern id="p" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="24" fill="#ffffff" opacity=".06"/></pattern></defs><rect width="480" height="300" fill="${color}"/><rect width="480" height="300" fill="url(#p)"/><text x="240" y="160" font-size="26" font-weight="700" text-anchor="middle" fill="#fff" font-family="sans-serif" letter-spacing="4">${label}</text><text x="240" y="190" font-size="13" text-anchor="middle" fill="#fff" opacity=".7" font-family="sans-serif">ảnh minh họa</text></svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
};

function seed() {
  const users = [
    ['admin', 'Quản trị hệ thống', 'ADMIN', null, null],
    ['CN001', 'Nguyễn Văn Công', 'WORKER', 1, 1], ['TT001', 'Trần Thị Thu', 'LEADER', 1, null], ['IE001', 'Lê Văn Hải', 'IE', null, null],
    ['KT001', 'Phạm Thị Lan', 'FINANCE', null, null], ['GD001', 'Võ Minh Đức', 'DIRECTOR', null, null],
    ['CN002', 'Đỗ Thị Mai', 'WORKER', 1, 2], ['CN003', 'Huỳnh Văn Tài', 'WORKER', 2, 3], ['CN004', 'Lý Thị Hồng', 'WORKER', 1, 1],
    ['CN005', 'Phan Quốc Bảo', 'WORKER', 2, 3], ['TT002', 'Ngô Văn Sơn', 'LEADER', 2, null], ['CN006', 'Trương Thị Ngọc', 'WORKER', 1, 2],
  ].map(([employee_code, full_name, role, workshop_id, line_id], i) => ({ id: i + 1, employee_code, full_name, role, factory_id: role === 'ADMIN' ? null : 1, workshop_id, line_id, is_active: true }));
  const db = {
    seq: { idea: 0, att: 0, ap: 0, task: 0, rw: 0, code: 0, cm: 0, user: users.length, line: 3 },
    users,
    categories: [['SAFETY', 'An toàn'], ['QUALITY', 'Chất lượng'], ['COST', 'Chi phí'], ['DELIVERY', 'Giao hàng / Năng suất'], ['5S', '5S / Môi trường làm việc'], ['OTHER', 'Khác']]
      .map(([code, name], i) => ({ id: i + 1, code, name })),
    factories: [{ id: 1, code: 'F1', name: 'Nhà máy Tây Ninh' }],
    workshops: [{ id: 1, factory_id: 1, code: 'WS-A', name: 'Xưởng May A' }, { id: 2, factory_id: 1, code: 'WS-B', name: 'Xưởng Cắt B' }],
    lines: [{ id: 1, workshop_id: 1, code: 'L01', name: 'Chuyền 01', qr_token: 'demo-line-01' },
      { id: 2, workshop_id: 1, code: 'L02', name: 'Chuyền 02', qr_token: 'demo-line-02' },
      { id: 3, workshop_id: 2, code: 'C01', name: 'Bàn cắt 01', qr_token: 'demo-line-03' }],
    ideas: [], attachments: [], approvals: [], tasks: [], financials: [], rewards: [], comments: [], likes: [],
  };
  const lineOf = (uid) => users.find((u) => u.id === uid).line_id || 1;
  const wsOf = (line) => db.lines.find((l) => l.id === line).workshop_id;
  const colors = ['#5b7f73', '#7d6a55', '#4e6a8a', '#8a5a5a', '#5a6f8a'];
  // [title, problem, proposal, category, wastes, tool, saving, submitter, status, type, ageDays, inv, annual]
  const T = [
    ['Gắn nam châm giữ kéo tại bàn may', 'Kéo thường rơi xuống sàn, mất 5–10 giây tìm mỗi lần, khoảng 40 lần mỗi ca.', 'Gắn dải nam châm cạnh bàn để giữ kéo cố định.', 5, ['MOTION'], '5S', 6e6, 2, 'COMPLETED', 'QUICK_WIN', 290],
    ['Băng tải cấp bán thành phẩm tự động', 'Công nhân phải đi lấy bán thành phẩm, mất khoảng 40 phút mỗi ca.', 'Lắp băng tải mini nối khu cắt và Chuyền 02.', 3, ['TRANSPORT', 'WAITING'], 'KANBAN', 120e6, 7, 'COMPLETED', 'MAJOR', 250, 30e6, 90e6],
    ['Đồ gá định vị túi áo', 'Tỷ lệ lỗi lệch túi 3,2% phải tháo ra may lại.', 'Làm đồ gá mica định vị túi, chống đặt sai.', 2, ['DEFECTS'], 'POKA_YOKE', 45e6, 2, 'IMPLEMENTING', 'MAJOR', 12],
    ['Sơn vạch phân làn lối đi xe đẩy', 'Xe đẩy và người đi chung lối, đã có 2 lần suýt va chạm trong tháng.', 'Sơn vạch vàng phân làn, gắn gương cầu tại góc khuất.', 1, ['MOTION'], 'VISUAL', 0, 7, 'PENDING_LEADER', null, 1],
    ['Thay đèn LED khu kiểm hàng', 'Đèn huỳnh quang tốn điện, thiếu sáng làm sót lỗi màu.', 'Thay 40 bóng LED 18W, đặt cảm biến tự tắt giờ nghỉ.', 3, ['DEFECTS'], 'OTHER', 24e6, 2, 'PENDING_IE', 'MAJOR', 3],
    ['Dùng thùng nhựa thay bao tải chứa phụ liệu', 'Bao tải dễ rách, phụ liệu rơi vãi.', 'Chuyển sang thùng nhựa có nắp.', 6, ['INVENTORY'], '5S', 0, 2, 'REJECTED', null, 30],
    ['Bảng Kanban cấp chỉ cho chuyền', 'Chuyền dừng trung bình 20 phút mỗi ngày vì hết chỉ.', 'Treo thẻ Kanban 2 thùng, kho cấp khi thẻ được rút.', 4, ['WAITING', 'INVENTORY'], 'KANBAN', 80e6, 9, 'COMPLETED', 'MAJOR', 200, 8e6, 72e6],
    ['Chuẩn hóa thao tác may cổ áo', 'Mỗi công nhân may cổ một kiểu, thời gian chênh lệch 35%.', 'Quay video thao tác chuẩn, dán bảng hướng dẫn tại máy.', 4, ['OVERPROCESSING', 'SKILLS'], 'STANDARD_WORK', 50e6, 3 + 8, 'COMPLETED', 'MAJOR', 160, 3e6, 55e6],
    ['Kệ dụng cụ có hình bóng (shadow board)', 'Mất thời gian tìm tua vít, kìm khi chỉnh máy.', 'Làm bảng treo dụng cụ có in hình bóng từng món.', 5, ['MOTION'], '5S', 4e6, 4 + 5, 'COMPLETED', 'QUICK_WIN', 140],
    ['Cảm biến dừng máy khi đứt chỉ', 'Đứt chỉ không phát hiện, may hỏng cả đường dài.', 'Gắn cảm biến đứt chỉ, máy tự dừng và bật đèn Andon.', 2, ['DEFECTS'], 'JIDOKA', 95e6, 10, 'COMPLETED', 'MAJOR', 110, 40e6, 110e6],
    ['Giảm thời gian chuyển mã hàng bàn cắt', 'Chuyển mã mất 45 phút do tìm rập và chỉnh máy.', 'Chuẩn bị rập trước, dùng xe đẩy chuyên dụng, kẹp nhanh.', 4, ['WAITING'], 'SMED', 150e6, 8, 'PENDING_FINANCE', 'MAJOR', 60],
    ['Tấm chắn an toàn cho máy cắt vòng', 'Tay công nhân gần lưỡi cắt khi đẩy vải.', 'Lắp tấm chắn mica và nút dừng khẩn cấp.', 1, ['DEFECTS'], 'POKA_YOKE', 0, 10, 'COMPLETED', 'QUICK_WIN', 95],
    ['Cắt theo đơn hàng thay vì cắt dồn', 'Cắt dồn cả tuần, bán thành phẩm tồn chất đống, dễ lẫn size.', 'Cắt theo nhịp chuyền mỗi 2 giờ.', 3, ['OVERPRODUCTION', 'INVENTORY'], 'KANBAN', 60e6, 8, 'IMPLEMENTING', 'MAJOR', 25],
    ['Bỏ bước kiểm tra trùng tại cuối chuyền', 'Hàng được kiểm 2 lần cùng tiêu chí ở chuyền và QC.', 'Gộp về một điểm kiểm, chuẩn hóa checklist.', 2, ['OVERPROCESSING'], 'STANDARD_WORK', 30e6, 12, 'PENDING_LEADER', null, 2],
    ['Lịch vệ sinh máy hằng ngày 5 phút', 'Máy bám bụi vải, hỏng dầu, dừng máy đột xuất.', 'Lập checklist TPM 5 phút đầu ca cho người vận hành.', 3, ['WAITING', 'DEFECTS'], 'TPM', 35e6, 4 + 5, 'QUICK_WIN', 'QUICK_WIN', 5],
    ['Hộp đựng nhãn chia ngăn theo size', 'Nhãn size để chung, gắn nhầm size 0,8%.', 'Hộp chia ngăn có màu riêng cho từng size.', 2, ['DEFECTS', 'MOTION'], 'POKA_YOKE', 12e6, 12, 'COMPLETED', 'QUICK_WIN', 45],
    ['Đào tạo chéo công đoạn cho công nhân', 'Khi có người nghỉ, chuyền thiếu người làm công đoạn khó.', 'Ma trận kỹ năng và lịch đào tạo chéo mỗi tháng.', 4, ['SKILLS'], 'STANDARD_WORK', 40e6, 3, 'PENDING_IE', 'MAJOR', 4],
    ['Di dời kho phụ liệu gần chuyền', 'Kho phụ liệu cách chuyền 80 mét, đi lại 30 lượt mỗi ngày.', 'Bố trí kệ phụ liệu dùng hằng ngày ngay đầu chuyền.', 4, ['TRANSPORT', 'MOTION'], '5S', 18e6, 11 + 1, 'REVISION_REQUESTED', null, 6],
    ['Bàn đứng điều chỉnh chiều cao khu ủi', 'Công nhân khu ủi đau lưng, năng suất giảm cuối ca.', 'Thay bàn ủi có chỉnh chiều cao theo người.', 1, ['MOTION'], 'OTHER', 0, 9, 'COMPLETED', 'QUICK_WIN', 75],
    ['Bảng hiệu suất theo giờ tại chuyền', 'Không biết chuyền đang chậm so với kế hoạch cho đến cuối ca.', 'Bảng trắng ghi sản lượng mỗi giờ, đánh dấu đỏ khi chậm.', 4, ['WAITING'], 'VISUAL', 25e6, 2, 'COMPLETED', 'QUICK_WIN', 20],
    ['Tái sử dụng vải vụn làm giẻ lau máy', 'Mua giẻ lau 2 triệu mỗi tháng trong khi vải vụn bị bỏ.', 'Cắt vải vụn làm giẻ lau, thu gom theo thùng màu.', 3, ['INVENTORY'], '5S', 24e6, 7, 'COMPLETED', 'QUICK_WIN', 10],
    ['Ý tưởng: lắp máy lọc nước khu nghỉ', 'Công nhân phải ra ngoài mua nước.', 'Lắp máy lọc nước tại khu nghỉ ca.', 6, [], null, 0, 2, 'DRAFT', null, 0],
  ];
  T.forEach(([title, problem, proposal, category_id, waste_types, lean_tool, saving, submitter, status, type, age, inv, annual]) => {
    const id = ++db.seq.idea, line_id = lineOf(submitter), workshop_id = wsOf(line_id);
    const at = (d, h = 0) => daysAgo(Math.max(0, age - d), h);
    const leader = workshop_id === 1 ? 3 : 11;
    const i = { id, code: `KZ-2026-${String(++db.seq.code).padStart(6, '0')}`, title, problem, proposal, expected_benefit: null, category_id, submitter_id: submitter,
      factory_id: 1, workshop_id, line_id, kaizen_type: type, status, assignee_id: null, estimated_saving: saving, waste_types, lean_tool,
      submitted_at: status === 'DRAFT' ? null : at(0), completed_at: null, created_at: at(0), updated_at: at(0) };
    db.ideas.push(i);
    const ap = (level, st, by, d, comment = null) => db.approvals.push({ id: ++db.seq.ap, idea_id: id, level, approver_role: level, workshop_id: level === 'LEADER' ? workshop_id : null,
      status: st, acted_by: st === 'PENDING' ? null : by, comment, created_at: at(d, 0), acted_at: st === 'PENDING' ? null : at(d, -6 - (id % 5) * 4) });
    if (status === 'DRAFT') return;
    if (status === 'PENDING_LEADER') ap('LEADER', 'PENDING', null, 0);
    else if (status === 'REVISION_REQUESTED') ap('LEADER', 'REVISION', leader, 0, 'Bổ sung số lượt đi lại thực tế và ảnh mặt bằng kho');
    else if (status === 'REJECTED') ap('LEADER', 'REJECTED', leader, 0, 'Trùng với dự án 5S của xưởng đã triển khai tháng trước');
    else ap('LEADER', 'APPROVED', leader, 0, type === 'QUICK_WIN' ? 'Làm ngay tại chuyền' : 'Chuyển Ban Kaizen thẩm định');
    if (type === 'QUICK_WIN') i.assignee_id = submitter;
    if (type === 'MAJOR' && status !== 'PENDING_LEADER') {
      if (status === 'PENDING_IE') ap('IE', 'PENDING', null, 1);
      else {
        ap('IE', 'APPROVED', 4, 1, 'Khả thi, IE theo dõi triển khai'); i.assignee_id = 4;
        const tasks = [['Khảo sát hiện trạng, đo thời gian', 'DONE'], ['Thiết kế giải pháp', 'DONE'], ['Thi công / lắp đặt', status === 'IMPLEMENTING' ? 'IN_PROGRESS' : 'DONE'], ['Đào tạo và chuẩn hóa', status === 'IMPLEMENTING' ? 'TODO' : 'DONE']];
        tasks.forEach(([t, st], k) => db.tasks.push({ id: ++db.seq.task, idea_id: id, title: t, status: st, assignee_id: k === 3 ? leader : 4, due_date: null, position: k + 1 }));
        db.financials.push({ idea_id: id, investment_cost: inv || Math.round(saving * 0.15), annual_saving: annual || saving, currency: 'VND', verified: status === 'COMPLETED', verified_at: status === 'COMPLETED' ? at(age * 0.8) : null });
        if (status === 'PENDING_FINANCE') ap('FINANCE', 'PENDING', null, age * 0.7);
        if (status === 'COMPLETED') ap('FINANCE', 'APPROVED', 5, age * 0.7, 'Đã đối chiếu hóa đơn và sản lượng 4 tuần');
      }
    }
    if (status === 'COMPLETED') {
      i.completed_at = at(type === 'MAJOR' ? age * 0.8 : 2);
      const fin = db.financials.find((f) => f.idea_id === id);
      db.rewards.push({ id: ++db.seq.rw, idea_id: id, user_id: submitter, points: type === 'MAJOR' ? 50 : 10, amount: fin ? Math.round(fin.annual_saving * 0.01) : 0,
        reason: type === 'MAJOR' ? 'MAJOR_PROJECT_COMPLETED' : 'QUICK_WIN_COMPLETED', status: 'GRANTED', created_at: i.completed_at });
    }
    db.attachments.push({ id: ++db.seq.att, idea_id: id, phase: 'BEFORE', file_name: `before-${id}.svg`, content_type: 'image/svg+xml', size_bytes: 1000, data: PIXEL(colors[id % colors.length], 'TRƯỚC'), created_at: at(0) });
    if (status === 'COMPLETED' || status === 'PENDING_FINANCE') db.attachments.push({ id: ++db.seq.att, idea_id: id, phase: 'AFTER', file_name: `after-${id}.svg`, content_type: 'image/svg+xml', size_bytes: 1000, data: PIXEL('#2e7d5b', 'SAU'), created_at: at(2) });
    [3, 6, 7, 9, 12].filter((u) => (u + id) % 3 === 0).forEach((u) => db.likes.push({ idea_id: id, user_id: u }));
  });
  const cm = (idea_id, user_id, body, d) => db.comments.push({ id: ++db.seq.cm, idea_id, user_id, body, created_at: daysAgo(d) });
  cm(2, 3, 'Ý tưởng rất hay, đề nghị nhân rộng sang Chuyền 01.', 240);
  cm(2, 6, 'Ban Giám đốc đánh giá cao. Tiết kiệm vượt kỳ vọng.', 195);
  cm(3, 4, 'Mẫu thử mica đầu tiên đã xong, đang chạy thử 3 ngày.', 6);
  cm(3, 2, 'Tôi có thể hỗ trợ đào tạo các bạn chuyền 01.', 5);
  cm(11, 5, 'Cần bảng chấm công chuyển mã 4 tuần để đối chiếu.', 8);
  cm(4, 9, 'Góc kho phía Đông cũng nên sơn vạch.', 0.5);
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
    line: db.lines.find((l) => l.id === i.line_id)?.name ?? null, submitter: nameOf(i.submitter_id), assignee: nameOf(i.assignee_id), thumb_id: thumb?.id ?? null,
    like_count: db.likes.filter((l) => l.idea_id === i.id).length, comment_count: db.comments.filter((x) => x.idea_id === i.id).length };
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
      const st = q.get('status'), w = q.get('waste'), ty = q.get('type'), kw = (q.get('q') || '').toLowerCase(), mine = q.get('mine') === 'true';
      const items = db.ideas.filter((i) => canView(c, i) && (!st || st.split(',').includes(i.status)) && (!w || (i.waste_types || []).includes(w))
        && (!ty || i.kaizen_type === ty) && (!mine || i.submitter_id === c.id) && (!kw || (i.title + ' ' + i.code).toLowerCase().includes(kw)))
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
        estimated_saving: +field('estimated_saving') || 0, lean_tool: field('lean_tool') || null,
        waste_types: String(field('waste_types') || '').split(',').filter(Boolean), submitted_at: null, completed_at: null, created_at: now(), updated_at: now() };
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
        financials: finView(db.financials.find((f) => f.idea_id === i.id)) || null,
        liked: db.likes.some((l) => l.idea_id === i.id && l.user_id === c.id),
        comments: db.comments.filter((x) => x.idea_id === i.id).map((x) => ({ ...x, full_name: nameOf(x.user_id), role: user(x.user_id)?.role })) };
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
          waiting_hours: Math.round((Date.now() - new Date(a.created_at)) / 36e5), problem: i.problem, proposal: i.proposal,
          waste_types: i.waste_types, lean_tool: i.lean_tool, thumb_id: i.thumb_id }; });
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
    case 'POST /kaizens/:id/comments': {
      const i = ideaOf(id);
      if (!canView(c, i)) err(403, 'forbidden');
      if (!String(body.body || '').trim()) err(400, 'Nhập nội dung bình luận');
      db.comments.push({ id: ++db.seq.cm, idea_id: i.id, user_id: c.id, body: String(body.body).trim().slice(0, 2000), created_at: now() });
      return { id: db.seq.cm };
    }
    case 'POST /kaizens/:id/like': {
      const i = ideaOf(id), k = db.likes.findIndex((l) => l.idea_id === i.id && l.user_id === c.id);
      if (k >= 0) db.likes.splice(k, 1); else db.likes.push({ idea_id: i.id, user_id: c.id });
      return { liked: k < 0, like_count: db.likes.filter((l) => l.idea_id === i.id).length };
    }
    case 'GET /activity': {
      const vis = (iid) => canView(c, ideaOf(iid));
      const ev = [];
      db.ideas.filter((i) => i.submitted_at && canView(c, i)).forEach((i) => {
        ev.push({ at: i.submitted_at, kind: 'SUBMITTED', idea_id: i.id, code: i.code, title: i.title, actor: nameOf(i.submitter_id), detail: null });
        if (i.completed_at) ev.push({ at: i.completed_at, kind: 'COMPLETED', idea_id: i.id, code: i.code, title: i.title, actor: nameOf(i.submitter_id), detail: null });
      });
      db.approvals.filter((a) => a.acted_at && vis(a.idea_id)).forEach((a) => { const i = ideaOf(a.idea_id);
        ev.push({ at: a.acted_at, kind: a.level + '_' + a.status, idea_id: i.id, code: i.code, title: i.title, actor: nameOf(a.acted_by), detail: a.comment }); });
      db.comments.filter((x) => vis(x.idea_id)).forEach((x) => { const i = ideaOf(x.idea_id);
        ev.push({ at: x.created_at, kind: 'COMMENT', idea_id: i.id, code: i.code, title: i.title, actor: nameOf(x.user_id), detail: x.body.slice(0, 140) }); });
      return ev.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
    }
    case 'GET /reports/trend': {
      const v = db.ideas.filter((i) => canView(c, i)), out = [];
      for (let k = 11; k >= 0; k--) {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - k);
        const m = d.toISOString().slice(0, 7);
        out.push({ month: m, submitted: v.filter((i) => i.submitted_at?.slice(0, 7) === m).length, completed: v.filter((i) => i.completed_at?.slice(0, 7) === m).length });
      }
      return out;
    }
    case 'GET /reports/wastes': {
      const from = q.get('from'), g = {};
      db.ideas.filter((i) => canView(c, i) && i.status !== 'DRAFT' && (!from || i.created_at >= from)).forEach((i) => (i.waste_types || []).forEach((w) => {
        g[w] ??= { waste: w, total: 0, completed: 0 }; g[w].total++; if (i.status === 'COMPLETED') g[w].completed++; }));
      return Object.values(g).sort((a, b) => b.total - a.total);
    }
    case 'GET /reports/leaderboard':
      return db.users.filter((u) => u.role !== 'ADMIN').map((u) => {
        const rw = db.rewards.filter((x) => x.user_id === u.id);
        return { user_id: u.id, full_name: u.full_name, role: u.role, workshop: db.workshops.find((w) => w.id === u.workshop_id)?.name ?? null,
          points: rw.reduce((s, x) => s + x.points, 0), amount: rw.reduce((s, x) => s + x.amount, 0),
          ideas: db.ideas.filter((i) => i.submitter_id === u.id && i.status !== 'DRAFT').length, completed: db.ideas.filter((i) => i.submitter_id === u.id && i.status === 'COMPLETED').length };
      }).sort((a, b) => b.points - a.points || b.ideas - a.ideas);
    case 'GET /admin/users':
      if (c.role !== 'ADMIN') err(403, 'forbidden');
      return db.users;
    case 'POST /admin/users': {
      if (c.role !== 'ADMIN') err(403, 'forbidden');
      if (!body.employee_code || !body.full_name) err(400, 'Cần mã nhân viên và họ tên');
      if (db.users.some((u) => u.employee_code === body.employee_code)) err(400, 'Mã nhân viên đã tồn tại');
      db.users.push({ id: ++db.seq.user, employee_code: body.employee_code, full_name: body.full_name, role: body.role, factory_id: 1, workshop_id: body.workshop_id || null, line_id: null, is_active: true });
      return { id: db.seq.user };
    }
    case 'POST /admin/lines': {
      if (c.role !== 'ADMIN') err(403, 'forbidden');
      if (!body.code || !body.name) err(400, 'Cần mã và tên dây chuyền');
      db.lines.push({ id: ++db.seq.line, workshop_id: +body.parent_id, code: body.code, name: body.name, qr_token: 'demo-line-' + Math.random().toString(36).slice(2, 8) });
      return { id: db.seq.line };
    }
    case 'GET /reports/summary': {
      const from = q.get('from'), v = db.ideas.filter((i) => canView(c, i) && (!from || i.created_at >= from)), sub = v.filter((i) => i.status !== 'DRAFT');
      const cnt = (f) => v.filter(f).length, done = cnt((i) => i.status === 'COMPLETED');
      const active = cnt((i) => !['DRAFT', 'REJECTED'].includes(i.status));
      const fin = db.financials.filter((f) => f.verified && v.some((i) => i.id === f.idea_id));
      const leaderHrs = db.approvals.filter((a) => a.level === 'LEADER' && a.acted_at).map((a) => (new Date(a.acted_at) - new Date(a.created_at)) / 36e5);
      const byCat = {}; sub.forEach((i) => { const n = listRow(i).category; byCat[n] = (byCat[n] || 0) + 1; });
      const top = {}; db.rewards.filter((x) => v.some((i) => i.id === x.idea_id)).forEach((x) => { const u = user(x.user_id); const k = u.full_name;
        top[k] ??= { full_name: k, workshop: db.workshops.find((w) => w.id === u.workshop_id)?.name, points: 0, ideas: 0 }; top[k].points += x.points; top[k].ideas++; });
      return { total_ideas: sub.length, completed: done, rejected: cnt((i) => i.status === 'REJECTED'),
        pending_approval: cnt((i) => i.status.startsWith('PENDING')), in_progress: cnt((i) => ['QUICK_WIN', 'IMPLEMENTING'].includes(i.status)),
        quick_wins: cnt((i) => i.kaizen_type === 'QUICK_WIN'), major_projects: cnt((i) => i.kaizen_type === 'MAJOR'),
        completion_rate: active ? Math.round(done / active * 1000) / 10 : 0,
        estimated_saving: v.filter((i) => i.status !== 'REJECTED').reduce((s, i) => s + i.estimated_saving, 0),
        verified_saving: fin.reduce((s, f) => s + f.annual_saving, 0), verified_investment: fin.reduce((s, f) => s + f.investment_cost, 0),
        avg_leader_response_hours: leaderHrs.length ? Math.round(leaderHrs.reduce((a, b) => a + b, 0) / leaderHrs.length * 10) / 10 : 0,
        participants: new Set(sub.map((i) => i.submitter_id)).size,
        by_status: Object.entries(v.reduce((g, i) => ((g[i.status] = (g[i.status] || 0) + 1), g), {})).map(([status, total]) => ({ status, total })),
        by_category: Object.entries(byCat).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
        top_contributors: Object.values(top).sort((a, b) => b.points - a.points) };
    }
    case 'GET /reports/roi': {
      const g = {};
      const from = q.get('from');
      db.ideas.filter((i) => i.status === 'COMPLETED' && canView(c, i) && (!from || i.completed_at >= from)).forEach((i) => {
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
