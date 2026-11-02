// Lean knowledge base + icon set shared by all views.

export const ICON_PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2v.2h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  board: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z',
  approve: 'M9 3h6v3H9zM8 4.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5.5a1 1 0 0 0-1-1h-2M9 14l2 2 4-4',
  chart: 'M3 3v18h18M7 15v2M11 11v6M15 7v10M19 12v5',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 21v-2h6v2',
  book: 'M4 19V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14',
  users: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  user: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM3 22a9 9 0 0 1 18 0',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
  camera: 'M14.5 4h-5L7.5 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-3.5zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  heart: 'M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  arrowR: 'M5 12h14M13 6l6 6-6 6',
  chevL: 'M15 18l-6-6 6-6',
  chevR: 'M9 18l6-6-6-6',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  coins: 'M9 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM18.1 10.4A6 6 0 1 1 10.3 18',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  flag: 'M4 22V4M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1',
  refresh: 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  layers: 'M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  hourglass: 'M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2',
  skill: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM3 22a9 9 0 0 1 12.5-8.3M19 15v3M19 21h.01',
  truck: 'M2 6h12v10H2zM14 9h4l3 3v4h-7M6.5 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  box: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  move: 'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  zap: 'M13 2 3 14h9l-1 8 10-12h-9z',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 13.5 7 22l5-3 5 3-1.5-8.5',
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  factory: 'M2 20V9l6 4V9l6 4V4h6v16zM2 20h20M6 16h2M11 16h2',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  wifiOff: 'M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.4-1.7M12 20h.01',
  menu: 'M4 6h16M4 12h16M4 18h16',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  image: 'M3 3h18v18H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  calendar: 'M3 5h18v16H3zM16 3v4M8 3v4M3 10h18',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  stop: 'M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9zM12 8v4M12 16h.01',
  timer: 'M10 2h4M12 14l3-3M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8',
  wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  trend: 'M22 7 13.5 15.5 8.5 10.5 2 17M16 7h6v6',
  cycle: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6',
  handshake: 'M11 17l2 2a1.4 1.4 0 0 0 2-2M14 14l2.5 2.5a1.4 1.4 0 0 0 2-2L15 11M2 11l5-5 4 2 3-2 3 1 5 5-3 3M2 11l4 4 3 3',
  road: 'M4 22 9 2M20 22 15 2M12 6v2M12 12v2M12 18v2',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  copy: 'M9 9h12v12H9zM5 15H3V3h12v2',
};

export function icon(name, size = 20, cls = '') {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON_PATHS[name] || ICON_PATHS.sparkles}"/></svg>`;
}

export const WASTES = [
  { code: 'DEFECTS', vi: 'Khuyết tật', en: 'Defects', icon: 'alert', desc: 'Lỗi phải sửa lại, hàng hỏng phải hủy bỏ.', example: 'Lệch đường may, sai kích thước, phải tháo ra làm lại.' },
  { code: 'OVERPRODUCTION', vi: 'Sản xuất thừa', en: 'Overproduction', icon: 'layers', desc: 'Làm nhiều hơn hoặc sớm hơn nhu cầu.', example: 'Cắt bán thành phẩm dồn sẵn cho cả tuần.' },
  { code: 'WAITING', vi: 'Chờ đợi', en: 'Waiting', icon: 'hourglass', desc: 'Người hoặc máy đứng chờ vật tư, thông tin, phê duyệt.', example: 'Chuyền dừng 20 phút chờ cấp chỉ.' },
  { code: 'SKILLS', vi: 'Lãng phí tài năng', en: 'Non-utilized talent', icon: 'skill', desc: 'Không tận dụng kiến thức, sáng tạo của con người.', example: 'Thợ lành nghề chỉ làm việc đơn giản, không được góp ý.' },
  { code: 'TRANSPORT', vi: 'Vận chuyển', en: 'Transportation', icon: 'truck', desc: 'Di chuyển vật tư, thông tin không cần thiết.', example: 'Kho phụ liệu cách chuyền 80 mét.' },
  { code: 'INVENTORY', vi: 'Tồn kho', en: 'Inventory', icon: 'box', desc: 'Nguyên liệu, bán thành phẩm, thành phẩm tồn dư.', example: 'Vải tồn 3 tháng chiếm chỗ và bị ẩm.' },
  { code: 'MOTION', vi: 'Thao tác thừa', en: 'Motion', icon: 'move', desc: 'Cử động, đi lại không tạo giá trị.', example: 'Cúi người nhặt dụng cụ, đi lại tìm kéo.' },
  { code: 'OVERPROCESSING', vi: 'Gia công thừa', en: 'Over-processing', icon: 'sliders', desc: 'Làm kỹ hơn hoặc phức tạp hơn mức khách hàng cần.', example: 'Kiểm tra 2 lần cùng một tiêu chí.' },
];
export const WASTE = Object.fromEntries(WASTES.map((w) => [w.code, w]));

export const TOOLS = [
  { code: 'KAIZEN', vi: 'Kaizen', icon: 'cycle', tag: 'Cải tiến liên tục', desc: 'Những thay đổi nhỏ, liên tục, do chính người làm việc đề xuất.', points: ['Thay đổi nhỏ, làm ngay', 'Mọi người cùng tham gia', 'Đo trước và sau'] },
  { code: '5S', vi: '5S', icon: 'grid', tag: 'Tổ chức nơi làm việc', desc: 'Sàng lọc, Sắp xếp, Sạch sẽ, Săn sóc, Sẵn sàng.', points: ['Sàng lọc – Seiri', 'Sắp xếp – Seiton', 'Sạch sẽ – Seiso', 'Săn sóc – Seiketsu', 'Sẵn sàng – Shitsuke'] },
  { code: 'POKA_YOKE', vi: 'Poka-Yoke', icon: 'shield', tag: 'Chống sai lỗi', desc: 'Thiết kế để lỗi không thể xảy ra hoặc bị phát hiện ngay.', points: ['Ngăn lỗi từ gốc', 'Cơ cấu an toàn', 'Làm đúng ngay lần đầu'] },
  { code: 'KANBAN', vi: 'Kanban', icon: 'board', tag: 'Quản lý trực quan dòng chảy', desc: 'Thẻ và bảng tín hiệu để kéo công việc theo nhu cầu.', points: ['Bảng công việc', 'Giới hạn việc dở dang', 'Cải thiện dòng chảy'] },
  { code: 'JIDOKA', vi: 'Jidoka', icon: 'stop', tag: 'Tự động hóa có trí tuệ', desc: 'Máy và người dừng lại khi có bất thường để sửa tận gốc.', points: ['Dừng và xử lý', 'Kiểm soát chất lượng', 'Chất lượng tại nguồn'] },
  { code: 'SMED', vi: 'SMED', icon: 'timer', tag: 'Chuyển đổi nhanh', desc: 'Rút ngắn thời gian chuyển đổi mã hàng xuống dưới 10 phút.', points: ['Tách việc trong/ngoài', 'Chuẩn bị trước', 'Đồ gá nhanh'] },
  { code: 'STANDARD_WORK', vi: 'Tiêu chuẩn hóa', icon: 'doc', tag: 'Công việc chuẩn', desc: 'Cách làm tốt nhất hiện tại được viết ra và áp dụng thống nhất.', points: ['Trình tự chuẩn', 'Takt time', 'Tồn chuẩn'] },
  { code: 'VISUAL', vi: 'Quản lý trực quan', icon: 'eye', tag: 'Nhìn là hiểu', desc: 'Vạch sơn, nhãn, bảng đèn giúp phát hiện bất thường trong vài giây.', points: ['Vạch kẻ, nhãn mác', 'Andon', 'Bảng hiệu suất'] },
  { code: 'TPM', vi: 'TPM', icon: 'wrench', tag: 'Bảo trì năng suất toàn diện', desc: 'Người vận hành cùng bảo trì để máy không hỏng đột xuất.', points: ['Bảo trì tự quản', 'Bảo trì phòng ngừa', 'OEE'] },
  { code: 'OTHER', vi: 'Khác', icon: 'sparkles', tag: 'Giải pháp khác', desc: 'Cải tiến không thuộc các công cụ trên.', points: [] },
];
export const TOOL = Object.fromEntries(TOOLS.map((t) => [t.code, t]));

export const PRINCIPLES = [
  ['cycle', 'Cải tiến liên tục', 'Liên tục hoàn thiện thói quen và hệ thống, mỗi ngày một chút.'],
  ['trash', 'Loại bỏ lãng phí', 'Bỏ đi thời gian, công sức và nguồn lực không tạo giá trị.'],
  ['doc', 'Tiêu chuẩn hóa', 'Viết ra cách làm tốt nhất để mọi người làm giống nhau.'],
  ['users', 'Trao quyền cho mọi người', 'Ai cũng có thể đề xuất, từ công nhân đến giám đốc.'],
  ['trend', 'Tập trung thay đổi nhỏ', 'Cải tiến nhỏ cộng dồn thành kết quả lớn.'],
  ['bulb', 'Tư duy giải quyết vấn đề', 'Tìm nguyên nhân gốc (5 Why), sửa hệ thống chứ không đổ lỗi.'],
  ['sliders', 'Cải tiến quy trình', 'Quy trình tốt tạo ra kết quả tốt.'],
  ['chart', 'Quyết định dựa trên dữ liệu', 'Đo lường và quan sát tại Gemba trước khi kết luận.'],
  ['handshake', 'Hợp tác & làm việc nhóm', 'Chia sẻ ý tưởng, cùng nhau nhân rộng cải tiến.'],
  ['road', 'Tư duy dài hạn', 'Tiến bộ đều đặn tạo tăng trưởng bền vững.'],
];

export const GEMBA_TOOLS = [
  ['eye', 'Gemba', 'Đến tận nơi, xem tận mắt', 'Quan sát quy trình tại hiện trường, nhận diện vấn đề và lắng nghe người lao động.'],
  ['layers', '3M', 'Muda · Mura · Muri', 'Muda là lãng phí, Mura là không đồng đều, Muri là quá tải. Loại bỏ cả ba để dòng chảy ổn định.'],
];

export const BELTS = [
  { code: 'WHITE', vi: 'Đai Trắng', min: 0, color: '#f4f4f1', edge: '#9a9a92', desc: 'Hiểu khái niệm Kaizen và 8 lãng phí. Bắt đầu gửi ý tưởng đầu tiên.', step: 'Học nền tảng' },
  { code: 'YELLOW', vi: 'Đai Vàng', min: 30, color: '#f2b705', edge: '#a87e00', desc: 'Tham gia cải tiến thường xuyên, hoàn thành các Quick Win tại chuyền.', step: 'Hỗ trợ quy trình' },
  { code: 'GREEN', vi: 'Đai Xanh', min: 100, color: '#2e9e4f', edge: '#1d6b34', desc: 'Dẫn dắt dự án cải tiến vừa, dùng công cụ Lean để đo lường.', step: 'Thực hành & cải tiến' },
  { code: 'BLACK', vi: 'Đai Đen', min: 300, color: '#1f1f1f', edge: '#000000', desc: 'Dẫn dắt dự án phức tạp, kèm cặp đồng nghiệp.', step: 'Dẫn dắt & kèm cặp' },
  { code: 'MASTER', vi: 'Đai Đen Bậc Thầy', min: 800, color: '#6b46c1', edge: '#44287f', desc: 'Định hướng chiến lược cải tiến toàn nhà máy, đào tạo Đai Đen.', step: 'Chiến lược & chuyển đổi' },
];

export function beltOf(points) {
  let i = 0;
  BELTS.forEach((b, k) => { if (points >= b.min) i = k; });
  const cur = BELTS[i], next = BELTS[i + 1] || null;
  const pct = next ? Math.round(((points - cur.min) / (next.min - cur.min)) * 100) : 100;
  return { ...cur, index: i, next, pct, toNext: next ? next.min - points : 0 };
}

export function beltSvg(b, size = 44) {
  return `<svg class="belt" width="${size}" height="${size}" viewBox="0 0 48 48" aria-label="${b.vi}" role="img">
    <circle cx="24" cy="22" r="15" fill="none" stroke="${b.edge}" stroke-width="9"/>
    <circle cx="24" cy="22" r="15" fill="none" stroke="${b.color}" stroke-width="6.5"/>
    <path d="M20 27 15.5 41M28 27l4.5 14" stroke="${b.edge}" stroke-width="6" stroke-linecap="round"/>
    <path d="M20 27 15.5 41M28 27l4.5 14" stroke="${b.color}" stroke-width="3.6" stroke-linecap="round"/>
    <rect x="17" y="17" width="14" height="11" rx="3" fill="${b.color}" stroke="${b.edge}" stroke-width="1.6"/></svg>`;
}

export const STATUS = {
  DRAFT: { vi: 'Nháp', tone: 'neutral' },
  PENDING_LEADER: { vi: 'Chờ sơ duyệt', tone: 'warn' },
  REVISION_REQUESTED: { vi: 'Cần chỉnh sửa', tone: 'warn' },
  REJECTED: { vi: 'Từ chối', tone: 'bad' },
  QUICK_WIN: { vi: 'Quick Win · đang làm', tone: 'info' },
  PENDING_IE: { vi: 'Chờ Ban Kaizen', tone: 'warn' },
  IMPLEMENTING: { vi: 'Đang triển khai', tone: 'info' },
  PENDING_FINANCE: { vi: 'Chờ thẩm định ROI', tone: 'warn' },
  COMPLETED: { vi: 'Hoàn thành', tone: 'good' },
  OFFLINE: { vi: 'Chờ đồng bộ', tone: 'neutral' },
};

export const ROLES = { WORKER: 'Công nhân', LEADER: 'Tổ trưởng', IE: 'Ban Kaizen / IE', FINANCE: 'Kế toán', DIRECTOR: 'Ban Giám đốc', ADMIN: 'Quản trị' };
