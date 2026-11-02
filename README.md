# Digital Kaizen System

Hệ thống quản lý Kaizen & Sáng kiến cải tiến nhà máy — triển khai theo tài liệu [SADD](docs/SADD.md).

<p align="center">
  <a href="https://thinhstudio.github.io/KaizenSystem/"><img src="https://img.shields.io/badge/%E2%96%B6%20M%E1%BB%9F%20trang%20demo-17694a?style=for-the-badge" alt="Mở trang demo" height="40"></a>
</p>

![Tổng quan](docs/screenshot-home.png)

- **Backend:** Go 1.26 (`net/http`, pgx) — REST API `/api/v1`, JWT + RBAC, workflow đa cấp, audit log.
- **Database:** PostgreSQL 16 (7 bảng nghiệp vụ + danh mục nhà máy/xưởng/chuyền/người dùng, ROI tính bằng generated column).
- **Frontend:** PWA (HTML/JS thuần, không cần build), offline-first với IndexedDB outbox + Service Worker, chụp ảnh bằng camera, QR theo chuyền.
- **Storage:** Local file store (interface `storage.Store` sẵn sàng thay bằng MinIO/S3).
- **Thông báo:** Telegram Bot và/hoặc webhook chung (Zalo OA bridge, n8n, Slack…).

## Tính năng chính

| Màn hình | Nội dung |
|---|---|
| Tổng quan | Lời chào theo ca, nguyên tắc Kaizen mỗi ngày, cấp đai cá nhân, KPI kèm sparkline, "Săn lãng phí tại Gemba", việc cần làm, dòng hoạt động |
| Sáng kiến | Thẻ có ảnh, lọc theo trạng thái / 8 lãng phí / loại / của tôi, tìm kiếm, xuất Excel (CSV UTF-8) |
| Bảng Kaizen | Kanban toàn cục theo chặng duyệt, nhìn ra điểm tắc nghẽn |
| Đề xuất | Wizard 3 bước: vấn đề + chọn lãng phí → giải pháp + công cụ Lean → ảnh (kéo thả/camera) + xem lại; chạy offline |
| Chi tiết | Thanh tiến trình vòng đời, so sánh Trước/Sau, Kanban triển khai, ROI, khen thưởng, lịch sử duyệt, thảo luận, ủng hộ |
| Phê duyệt | Thẻ duyệt có ảnh, hiện trạng/đề xuất, đồng hồ SLA 48 giờ, Quick Win / Dự án lớn, nhập số liệu xác thực của Kế toán |
| Phân tích & ROI | KPI, biểu đồ đề xuất/hoàn thành 12 tháng, tỷ lệ hoàn thành, lãng phí được tấn công, phễu chuyển đổi, ROI theo xưởng/tháng |
| Bảng vàng | Bục vinh danh, xếp hạng, 5 cấp đai Kaizen (Trắng → Đen Bậc Thầy) theo điểm |
| Học viện Lean | 10 nguyên tắc Kaizen, 8 lãng phí (DOWNTIME), công cụ Gemba / 3M / 5S / Poka-Yoke / Kanban / Jidoka / SMED / TPM…, lộ trình đai |
| Quản trị | Người dùng, dây chuyền và liên kết QR |

Giao diện hỗ trợ **4 ngôn ngữ**: Tiếng Việt, English, 中文, Bahasa Indonesia (chọn ở thanh trên cùng hoặc màn hình đăng nhập; mặc định theo ngôn ngữ trình duyệt). Có chế độ sáng/tối, tối ưu cho điện thoại (thanh điều hướng dưới, nút chụp ảnh ở giữa) và máy tính.

## Bản demo trực tuyến

Bản demo chạy hoàn toàn trong trình duyệt (mock backend `backend/web/js/mock.js`, dữ liệu lưu localStorage), không cần server:

- Build: `python3 scripts/build-demo.py` → `demo/index.html` (một file duy nhất, mở trực tiếp được).
- GitHub Pages: workflow `.github/workflows/pages.yml` tự deploy mỗi lần push lên `main`
  (bật một lần: **Settings → Pages → Source: GitHub Actions**). Địa chỉ: [https://thinhstudio.github.io/KaizenSystem/](https://thinhstudio.github.io/KaizenSystem/).

## Đa ngôn ngữ (i18n)

- Toàn bộ chuỗi giao diện nằm trong `backend/web/js/i18n.js`, khóa là câu tiếng Việt gốc, giá trị là `[English, 中文, Indonesia]`.
- Chuỗi tĩnh được dịch tự động khi hiển thị; chuỗi có số liệu dùng `t('Còn {n} điểm…', { n })`.
- Nội dung người dùng nhập (tiêu đề, mô tả, bình luận, tên người, tên xưởng) giữ nguyên, được đánh dấu `data-notr`.
- Thêm ngôn ngữ mới: thêm một mục vào `LANGS` và một cột vào từng dòng của từ điển.

## Chạy nhanh (Docker)

```bash
cp .env.example .env   # đặt JWT_SECRET
docker compose up -d --build
```

Mở http://localhost:8080. Với `SEED_DEMO=true` có sẵn tài khoản (mật khẩu `123456`):

| Mã | Vai trò |
|---|---|
| CN001 | Công nhân (WORKER) |
| TT001 | Tổ trưởng (LEADER) |
| IE001 | Ban Kaizen / IE |
| KT001 | Kế toán (FINANCE) |
| GD001 | Giám đốc (DIRECTOR) |
| admin / `ADMIN_PASSWORD` | Quản trị (ADMIN) |

Dịch vụ `backup` trong compose chạy `pg_dump` mỗi ngày vào `./backups` (giữ 14 ngày).

## Chạy local không Docker

```bash
cd backend
DATABASE_URL=postgres://kaizen:kaizen@localhost:5432/kaizen?sslmode=disable SEED_DEMO=true go run ./cmd/api
```

Migration được nhúng trong binary và tự chạy khi khởi động.

## Kiểm thử end-to-end

Với API đang chạy và `SEED_DEMO=true` trên DB trống:

```bash
./scripts/e2e.sh
```

Script chạy trọn 3 luồng: Quick Win, Dự án lớn (IE → Kanban → Kế toán → thưởng), Từ chối, cùng các ràng buộc (bắt buộc ảnh After, task chưa DONE, bắt buộc lý do từ chối).

## Mã QR tại chuyền

Mỗi `production_lines` có `qr_token`. In QR trỏ đến `https://<host>/#/new?line=<qr_token>` — công nhân quét là mở form đề xuất đã gắn đúng xưởng/chuyền.

## Cấu hình (biến môi trường)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | `postgres://kaizen:kaizen@localhost:5432/kaizen` | Kết nối PostgreSQL |
| `JWT_SECRET` | — | Khóa ký JWT (bắt buộc đổi) |
| `JWT_TTL_HOURS` | 12 | Thời hạn token (1 ca làm việc) |
| `STORAGE_DIR` | `./data/uploads` | Thư mục lưu ảnh/video |
| `MAX_UPLOAD_MB` | 25 | Giới hạn upload mỗi request |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | — | Thông báo Telegram |
| `NOTIFY_WEBHOOK_URL` | — | Webhook JSON cho mọi sự kiện |
| `REWARD_QUICKWIN_POINTS` / `REWARD_MAJOR_POINTS` | 10 / 50 | Điểm thưởng |
| `REWARD_RATE_PCT` | 1 | % tiết kiệm đã xác thực trả thưởng cho dự án lớn |
