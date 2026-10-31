# SADD — Digital Kaizen System (bản triển khai)

Tài liệu này ghi lại các quyết định thiết kế khi hiện thực hóa SADD gốc.

## 1. Kiến trúc đã chọn

```
PWA (Mobile/Tablet/Kiosk)  ──HTTPS/REST──►  Go API (cmd/api)
  ├─ Service Worker (cache shell + GET API)        ├─ auth     JWT HS256 + bcrypt, RBAC
  └─ IndexedDB outbox (offline sync)               ├─ api      handlers + workflow state machine
                                                   ├─ db       pgxpool + migration nhúng
                                                   ├─ storage  Local FS (interface → MinIO/S3)
                                                   └─ notify   Telegram / webhook (async)
                                                         │
                                                   PostgreSQL 16
```

Chọn Go (thay vì .NET) để có một binary nhỏ, khởi động nhanh, chạy tốt trên máy chủ nội bộ nhà máy.
Frontend viết bằng ES modules thuần — không cần build, dễ bảo trì; có thể chuyển sang Vue/React sau mà không đổi API.

## 2. Vòng đời sáng kiến (state machine)

| Trạng thái | Hành động | Người thực hiện | Trạng thái kế tiếp |
|---|---|---|---|
| DRAFT / REVISION_REQUESTED | submit | Người đề xuất | PENDING_LEADER |
| PENDING_LEADER | APPROVE + `QUICK_WIN` | Tổ trưởng cùng xưởng | QUICK_WIN |
| PENDING_LEADER | APPROVE + `MAJOR` | Tổ trưởng cùng xưởng | PENDING_IE |
| PENDING_LEADER / PENDING_IE | REVISION | Tổ trưởng / IE | REVISION_REQUESTED |
| bất kỳ PENDING_* | REJECT (bắt buộc lý do) | Người duyệt cấp đó | REJECTED |
| QUICK_WIN | complete (bắt buộc ảnh After) | Người phụ trách / Tổ trưởng | COMPLETED + điểm |
| PENDING_IE | APPROVE (+ người phụ trách, dự toán) | IE | IMPLEMENTING |
| IMPLEMENTING | complete (mọi task DONE + ảnh After) | Người phụ trách / IE | PENDING_FINANCE |
| PENDING_FINANCE | APPROVE (số liệu xác thực) | Kế toán | COMPLETED + điểm + thưởng % |
| PENDING_FINANCE | REVISION | Kế toán | IMPLEMENTING |

Mỗi sáng kiến chỉ có tối đa **một** approval PENDING (unique partial index). Mọi chuyển trạng thái chạy trong transaction với `SELECT … FOR UPDATE` và ghi `audit_logs`.

## 3. Cơ sở dữ liệu

Xem `backend/internal/db/migrations/001_init.sql`. Ngoài 7 bảng nghiệp vụ (`kaizen_categories`, `kaizen_ideas`,
`kaizen_attachments`, `kaizen_approvals`, `kaizen_tasks`, `kaizen_financials`, `kaizen_rewards`) có thêm
`factories`, `workshops`, `production_lines` (kèm `qr_token`), `users`, `audit_logs`.

- `kaizen_financials.roi_percent` = (tiết kiệm năm − đầu tư) / đầu tư × 100 và `payback_months` là **generated column**, không thể lệch dữ liệu.
- `kaizen_ideas.client_uuid` UNIQUE: khóa idempotent cho đồng bộ offline (gửi lại không tạo bản trùng).
- `kaizen_rewards` UNIQUE (idea, user, reason): không thưởng trùng.
- Tiền tệ dùng `NUMERIC(18,2)`.

## 4. API

| Nhóm | Endpoint |
|---|---|
| Auth | `POST /auth/login`, `GET /auth/me`, `GET /me/rewards` |
| Kaizen | `POST/GET /kaizens`, `GET/PUT /kaizens/{id}`, `POST /kaizens/{id}/submit`, `POST /kaizens/{id}/complete`, `POST /kaizens/{id}/attachments`, `PUT /kaizens/{id}/financials`, `GET /attachments/{id}/file` |
| Approvals | `GET /approvals/pending`, `POST /approvals/{approval_id}/action` `{action: APPROVE\|REJECT\|REVISION, comment, kaizen_type, assignee_id, investment_cost, annual_saving}` |
| Kanban | `GET/POST /kaizens/{id}/tasks`, `PATCH /kaizens/tasks/{task_id}/status` |
| Reports | `GET /reports/summary`, `GET /reports/roi` (lọc `from`, `to`, `workshop_id`) |
| Master/Admin | `GET /categories`, `GET /master`, `GET /lines/qr/{token}`, `GET/POST /admin/users`, `POST /admin/{factories,workshops,lines,categories}` |

`GET /kaizens` hỗ trợ `page`, `page_size` (≤100), `status` (danh sách cách bởi dấu phẩy), `workshop_id`, `category_id`, `from`, `to`, `q`, `mine`.

## 5. Phân quyền dữ liệu

| Vai trò | Phạm vi xem |
|---|---|
| WORKER | Sáng kiến của mình (và được giao) |
| LEADER | Toàn bộ xưởng của mình |
| IE / FINANCE / DIRECTOR | Toàn nhà máy được gán (`factory_id`) |
| ADMIN | Toàn hệ thống |

## 6. Yêu cầu phi chức năng — cách đáp ứng

- **Hiệu năng:** index theo trạng thái/xưởng/người đề xuất, phân trang, ảnh lazy-load, cache 1 ngày cho file đính kèm.
- **Offline-first:** form đề xuất (kèm ảnh) lưu vào IndexedDB khi mất mạng; tự đồng bộ khi `online` và mỗi 30 giây; `client_uuid` chống trùng.
- **Bảo mật:** JWT, bcrypt, kiểm tra quyền ở từng handler, whitelist MIME upload, chống path traversal, chạy container non-root.
- **Sẵn sàng:** Docker Compose `restart: unless-stopped`, healthcheck, graceful shutdown, backup `pg_dump` hằng ngày.

## 7. Hướng mở rộng

- Adapter MinIO/S3 cho `storage.Store`; WebSocket/SSE cho dashboard kiosk realtime.
- Refresh token; SSO/AD; cấu hình luồng duyệt động theo xưởng (bảng `workflow_definitions`).
- Unit test cho state machine; nén ảnh phía client trước khi upload.
