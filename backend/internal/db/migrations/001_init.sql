-- Digital Kaizen System - initial schema
-- Master data (factories / workshops / lines / users) + 7 core kaizen tables.


-- ===================== MASTER DATA =====================
CREATE TABLE factories (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(32)  NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE workshops (
    id          BIGSERIAL PRIMARY KEY,
    factory_id  BIGINT       NOT NULL REFERENCES factories(id),
    code        VARCHAR(32)  NOT NULL,
    name        VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (factory_id, code)
);

CREATE TABLE production_lines (
    id          BIGSERIAL PRIMARY KEY,
    workshop_id BIGINT       NOT NULL REFERENCES workshops(id),
    code        VARCHAR(32)  NOT NULL,
    name        VARCHAR(255) NOT NULL,
    qr_token    UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(), -- printed as QR at the line
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (workshop_id, code)
);

CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    employee_code VARCHAR(32)  NOT NULL UNIQUE,
    full_name     VARCHAR(255) NOT NULL,
    email         VARCHAR(255),
    password_hash TEXT         NOT NULL,
    role          VARCHAR(16)  NOT NULL
                  CHECK (role IN ('WORKER','LEADER','IE','FINANCE','DIRECTOR','ADMIN')),
    factory_id    BIGINT REFERENCES factories(id),
    workshop_id   BIGINT REFERENCES workshops(id),
    line_id       BIGINT REFERENCES production_lines(id),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ===================== 1. CATEGORIES =====================
CREATE TABLE kaizen_categories (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(32)  NOT NULL UNIQUE,   -- SAFETY, QUALITY, COST, DELIVERY, ...
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE
);

-- ===================== 2. IDEAS =====================
CREATE TABLE kaizen_ideas (
    id                BIGSERIAL PRIMARY KEY,
    code              VARCHAR(32)  NOT NULL UNIQUE,          -- KZ-2026-000123
    client_uuid       UUID UNIQUE,                            -- idempotency key for offline sync
    title             VARCHAR(255) NOT NULL,
    problem           TEXT         NOT NULL,                  -- current state (Before)
    proposal          TEXT         NOT NULL,                  -- proposed improvement
    expected_benefit  TEXT,
    category_id       BIGINT       NOT NULL REFERENCES kaizen_categories(id),
    submitter_id      BIGINT       NOT NULL REFERENCES users(id),
    factory_id        BIGINT       NOT NULL REFERENCES factories(id),
    workshop_id       BIGINT       NOT NULL REFERENCES workshops(id),
    line_id           BIGINT       REFERENCES production_lines(id),
    kaizen_type       VARCHAR(16)  CHECK (kaizen_type IN ('QUICK_WIN','MAJOR')),
    status            VARCHAR(24)  NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT','PENDING_LEADER','REVISION_REQUESTED','REJECTED',
                                        'QUICK_WIN','PENDING_IE','IMPLEMENTING',
                                        'PENDING_FINANCE','COMPLETED')),
    assignee_id       BIGINT       REFERENCES users(id),
    estimated_saving  NUMERIC(18,2) NOT NULL DEFAULT 0,
    submitted_at      TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_ideas_status    ON kaizen_ideas(status);
CREATE INDEX idx_ideas_workshop  ON kaizen_ideas(workshop_id, created_at DESC);
CREATE INDEX idx_ideas_submitter ON kaizen_ideas(submitter_id, created_at DESC);

-- ===================== 3. ATTACHMENTS =====================
CREATE TABLE kaizen_attachments (
    id           BIGSERIAL PRIMARY KEY,
    idea_id      BIGINT       NOT NULL REFERENCES kaizen_ideas(id) ON DELETE CASCADE,
    phase        VARCHAR(8)   NOT NULL CHECK (phase IN ('BEFORE','AFTER','OTHER')),
    object_key   TEXT         NOT NULL,
    file_name    VARCHAR(255) NOT NULL,
    content_type VARCHAR(128) NOT NULL,
    size_bytes   BIGINT       NOT NULL,
    uploaded_by  BIGINT       NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_attachments_idea ON kaizen_attachments(idea_id);

-- ===================== 4. APPROVALS (multi-level workflow) =====================
CREATE TABLE kaizen_approvals (
    id            BIGSERIAL PRIMARY KEY,
    idea_id       BIGINT      NOT NULL REFERENCES kaizen_ideas(id) ON DELETE CASCADE,
    level         VARCHAR(16) NOT NULL CHECK (level IN ('LEADER','IE','FINANCE')),
    approver_role VARCHAR(16) NOT NULL,
    workshop_id   BIGINT      REFERENCES workshops(id),        -- scope (LEADER level)
    status        VARCHAR(16) NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','APPROVED','REJECTED','REVISION')),
    acted_by      BIGINT      REFERENCES users(id),
    comment       TEXT,
    acted_at      TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_approvals_pending ON kaizen_approvals(approver_role, status) WHERE status = 'PENDING';
CREATE UNIQUE INDEX uq_approvals_one_pending ON kaizen_approvals(idea_id) WHERE status = 'PENDING';

-- ===================== 5. TASKS (Kanban) =====================
CREATE TABLE kaizen_tasks (
    id          BIGSERIAL PRIMARY KEY,
    idea_id     BIGINT       NOT NULL REFERENCES kaizen_ideas(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    assignee_id BIGINT       REFERENCES users(id),
    status      VARCHAR(16)  NOT NULL DEFAULT 'TODO'
                CHECK (status IN ('TODO','IN_PROGRESS','DONE')),
    due_date    DATE,
    position    INT          NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_idea ON kaizen_tasks(idea_id, status, position);

-- ===================== 6. FINANCIALS (ROI) =====================
CREATE TABLE kaizen_financials (
    id                 BIGSERIAL PRIMARY KEY,
    idea_id            BIGINT        NOT NULL UNIQUE REFERENCES kaizen_ideas(id) ON DELETE CASCADE,
    investment_cost    NUMERIC(18,2) NOT NULL DEFAULT 0,
    annual_saving      NUMERIC(18,2) NOT NULL DEFAULT 0,
    currency           CHAR(3)       NOT NULL DEFAULT 'VND',
    -- ROI % = (annual_saving - investment_cost) / investment_cost * 100
    roi_percent        NUMERIC(12,2) GENERATED ALWAYS AS (
                          CASE WHEN investment_cost > 0
                               THEN round((annual_saving - investment_cost) / investment_cost * 100, 2)
                          END) STORED,
    payback_months     NUMERIC(10,2) GENERATED ALWAYS AS (
                          CASE WHEN annual_saving > 0
                               THEN round(investment_cost / annual_saving * 12, 2)
                          END) STORED,
    verified           BOOLEAN       NOT NULL DEFAULT FALSE,
    verified_by        BIGINT        REFERENCES users(id),
    verified_at        TIMESTAMPTZ,
    note               TEXT,
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ===================== 7. REWARDS =====================
CREATE TABLE kaizen_rewards (
    id          BIGSERIAL PRIMARY KEY,
    idea_id     BIGINT        NOT NULL REFERENCES kaizen_ideas(id),
    user_id     BIGINT        NOT NULL REFERENCES users(id),
    points      INT           NOT NULL DEFAULT 0,
    amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
    reason      VARCHAR(255)  NOT NULL,
    status      VARCHAR(16)   NOT NULL DEFAULT 'GRANTED' CHECK (status IN ('GRANTED','PAID','CANCELLED')),
    granted_by  BIGINT        REFERENCES users(id),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    UNIQUE (idea_id, user_id, reason)
);
CREATE INDEX idx_rewards_user ON kaizen_rewards(user_id);

-- ===================== AUDIT LOG =====================
CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    actor_id    BIGINT REFERENCES users(id),
    entity      VARCHAR(32) NOT NULL,
    entity_id   BIGINT      NOT NULL,
    action      VARCHAR(32) NOT NULL,
    data        JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id);

CREATE SEQUENCE kaizen_code_seq;

-- ===================== SEED: categories =====================
INSERT INTO kaizen_categories (code, name) VALUES
  ('SAFETY',   'An toàn'),
  ('QUALITY',  'Chất lượng'),
  ('COST',     'Chi phí'),
  ('DELIVERY', 'Giao hàng / Năng suất'),
  ('5S',       '5S / Môi trường làm việc'),
  ('OTHER',    'Khác');
