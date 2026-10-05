-- HOA site schema (PostgreSQL 14+)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS announcements (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  body        TEXT NOT NULL,
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  author      TEXT,
  emailed_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_announcements_order ON announcements (pinned DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS documents (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'General',   -- Bylaws, Minutes, Financials, Forms...
  description  TEXT,
  s3_key       TEXT NOT NULL UNIQUE,
  filename     TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes   BIGINT,
  uploaded     BOOLEAN NOT NULL DEFAULT FALSE,     -- true once the browser finishes the S3 upload
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents (category, created_at DESC);

CREATE TABLE IF NOT EXISTS subscribers (
  id                SERIAL PRIMARY KEY,
  email             CITEXT NOT NULL UNIQUE,
  name              TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'unsubscribed')),
  confirm_token     UUID NOT NULL DEFAULT gen_random_uuid(),
  unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at      TIMESTAMPTZ,
  unsubscribed_at   TIMESTAMPTZ
);
