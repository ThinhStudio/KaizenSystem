# Digital Kaizen System

Hệ thống quản lý Kaizen & Sáng kiến cải tiến nhà máy — triển khai theo tài liệu [SADD](docs/SADD.md).

- **Backend:** Go 1.26 (`net/http`, pgx) — REST API `/api/v1`, JWT + RBAC, workflow đa cấp, audit log.
- **Database:** PostgreSQL 16 (7 bảng nghiệp vụ + danh mục nhà máy/xưởng/chuyền/người dùng, ROI tính bằng generated column).
- **Frontend:** PWA (HTML/JS thuần, không cần build), offline-first với IndexedDB outbox + Service Worker, chụp ảnh bằng camera, QR theo chuyền.
- **Storage:** Local file store (interface `storage.Store` sẵn sàng thay bằng MinIO/S3).
- **Thông báo:** Telegram Bot và/hoặc webhook chung (Zalo OA bridge, n8n, Slack…).

## Bản demo trực tuyến

Bản demo chạy hoàn toàn trong trình duyệt (mock backend `backend/web/js/mock.js`, dữ liệu lưu localStorage), không cần server:

- Build: `python3 scripts/build-demo.py` → `demo/index.html` (một file duy nhất, mở trực tiếp được).
- GitHub Pages: workflow `.github/workflows/pages.yml` tự deploy mỗi lần push lên `main`
  (bật một lần: **Settings → Pages → Source: GitHub Actions**). Địa chỉ: `https://thinhstudio.github.io/KaizenSystem/`.

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
