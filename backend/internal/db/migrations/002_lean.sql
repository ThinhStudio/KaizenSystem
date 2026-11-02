-- Lean classification, social engagement and reporting support.

ALTER TABLE kaizen_ideas
  ADD COLUMN waste_types TEXT[] NOT NULL DEFAULT '{}',   -- 8 wastes (DOWNTIME)
  ADD COLUMN lean_tool   VARCHAR(32);                     -- 5S, POKA_YOKE, KANBAN, ...

ALTER TABLE kaizen_ideas ADD CONSTRAINT chk_waste_types CHECK (
  waste_types <@ ARRAY['DEFECTS','OVERPRODUCTION','WAITING','SKILLS','TRANSPORT','INVENTORY','MOTION','OVERPROCESSING']::text[]);
ALTER TABLE kaizen_ideas ADD CONSTRAINT chk_lean_tool CHECK (
  lean_tool IS NULL OR lean_tool IN ('KAIZEN','5S','POKA_YOKE','KANBAN','JIDOKA','SMED','STANDARD_WORK','VISUAL','TPM','OTHER'));
CREATE INDEX idx_ideas_wastes ON kaizen_ideas USING GIN (waste_types);

CREATE TABLE kaizen_comments (
    id         BIGSERIAL PRIMARY KEY,
    idea_id    BIGINT      NOT NULL REFERENCES kaizen_ideas(id) ON DELETE CASCADE,
    user_id    BIGINT      NOT NULL REFERENCES users(id),
    body       TEXT        NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_idea ON kaizen_comments(idea_id, created_at);

CREATE TABLE kaizen_likes (
    idea_id    BIGINT      NOT NULL REFERENCES kaizen_ideas(id) ON DELETE CASCADE,
    user_id    BIGINT      NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (idea_id, user_id)
);
