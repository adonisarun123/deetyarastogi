-- Baking Scrapbook: initial schema
-- All timestamps are timestamptz (stored UTC). Display timezone is Asia/Kolkata.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ───────────────────────── Accounts ─────────────────────────
CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,
  display_name   text NOT NULL,
  role           text NOT NULL CHECK (role IN ('owner', 'author')),
  password_hash  text NOT NULL,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  totp_secret    text,
  totp_enabled   boolean NOT NULL DEFAULT false,
  failed_logins  integer NOT NULL DEFAULT 0,
  locked_until   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id           text PRIMARY KEY,               -- sha256 of the cookie token
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mfa_pending  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  user_agent   text
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

CREATE TABLE invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash  text NOT NULL UNIQUE,
  email       text NOT NULL,
  role        text NOT NULL CHECK (role IN ('owner', 'author')),
  purpose     text NOT NULL DEFAULT 'invite' CHECK (purpose IN ('invite', 'reset')),
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────── Public identity & settings ───────────────────
CREATE TABLE site_settings (
  id          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL
);
INSERT INTO site_settings (id, data) VALUES (1, '{}'::jsonb);

CREATE TABLE author_profile (
  id          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL
);
INSERT INTO author_profile (id, data) VALUES (1, '{}'::jsonb);

CREATE TABLE experiences (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           text NOT NULL CHECK (kind IN ('interest', 'training', 'internship', 'next', 'other')),
  title          text NOT NULL,
  organisation   text,
  role           text,
  period         text,
  description    text,
  details        jsonb NOT NULL DEFAULT '[]'::jsonb,   -- responsibilities / subjects / things learnt
  is_public      boolean NOT NULL DEFAULT false,         -- only verified facts go public
  display_order  integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────── Taxonomy ─────────────────────────
CREATE TABLE terms (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL CHECK (kind IN ('category', 'tag')),
  name         text NOT NULL,
  slug         text NOT NULL,
  merged_into  uuid REFERENCES terms(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, slug)
);

-- ───────────────────────── Media ─────────────────────────
CREATE TABLE media_assets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_key     text NOT NULL,                 -- private storage key, never exposed
  original_name    text,                          -- private, never exposed publicly
  mime             text NOT NULL,
  bytes            bigint NOT NULL DEFAULT 0,
  width            integer,
  height           integer,
  state            text NOT NULL DEFAULT 'uploading'
                   CHECK (state IN ('uploading', 'processing', 'ready', 'failed')),
  error            text,
  default_alt      text NOT NULL DEFAULT '',
  default_caption  text NOT NULL DEFAULT '',
  credit           text NOT NULL DEFAULT '',
  focal_x          real NOT NULL DEFAULT 0.5,
  focal_y          real NOT NULL DEFAULT 0.5,
  upload_request   text UNIQUE,                   -- idempotency key from the client
  created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);
CREATE INDEX media_assets_created_idx ON media_assets(created_at DESC);

CREATE TABLE media_variants (
  asset_id  uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  width     integer NOT NULL,
  height    integer NOT NULL,
  format    text NOT NULL,
  key       text NOT NULL,
  bytes     bigint NOT NULL,
  PRIMARY KEY (asset_id, width, format)
);

-- ───────────────────────── Entries ─────────────────────────
CREATE TABLE entries (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type                   text NOT NULL CHECK (type IN ('story', 'recipe', 'video', 'tip', 'journal')),
  slug                   text NOT NULL,
  state                  text NOT NULL DEFAULT 'draft'
                         CHECK (state IN ('draft', 'published', 'unpublished', 'trashed')),
  pre_trash_state        text,
  working_revision_id    uuid,
  published_revision_id  uuid,
  working_version        integer NOT NULL DEFAULT 1,     -- optimistic concurrency token
  has_unpublished_changes boolean NOT NULL DEFAULT true,
  first_published_at     timestamptz,
  last_published_at      timestamptz,
  trashed_at             timestamptz,
  last_publish_request   text,
  created_by             uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (type, slug)
);
CREATE INDEX entries_state_idx ON entries(state, updated_at DESC);

CREATE TABLE entry_revisions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id     uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('working', 'published', 'snapshot')),
  content      jsonb NOT NULL,      -- title, summary, blocks, cover, gallery, category, tags, related, video, recipe, seo
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  note         text
);
CREATE INDEX entry_revisions_entry_idx ON entry_revisions(entry_id, created_at DESC);

ALTER TABLE entries
  ADD CONSTRAINT entries_working_fk FOREIGN KEY (working_revision_id) REFERENCES entry_revisions(id) ON DELETE SET NULL,
  ADD CONSTRAINT entries_published_fk FOREIGN KEY (published_revision_id) REFERENCES entry_revisions(id) ON DELETE SET NULL;

-- Denormalised index of currently-published entries. Public reads use ONLY this
-- table plus the published revision it points to. Unpublish deletes the row.
CREATE TABLE public_entries (
  entry_id            uuid PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
  revision_id         uuid NOT NULL REFERENCES entry_revisions(id),
  type                text NOT NULL,
  slug                text NOT NULL,
  title               text NOT NULL,
  summary             text NOT NULL DEFAULT '',
  cover               jsonb,
  category_id         uuid REFERENCES terms(id) ON DELETE SET NULL,
  tag_ids             uuid[] NOT NULL DEFAULT '{}',
  difficulty          text,
  total_minutes       integer,
  search_title        text NOT NULL DEFAULT '',
  search_terms        text NOT NULL DEFAULT '',   -- tags, category, ingredient names
  search_body         text NOT NULL DEFAULT '',
  first_published_at  timestamptz NOT NULL,
  updated_at          timestamptz NOT NULL
);
CREATE INDEX public_entries_type_idx ON public_entries(type, first_published_at DESC, entry_id);
CREATE INDEX public_entries_cat_idx ON public_entries(category_id);
CREATE INDEX public_entries_tags_idx ON public_entries USING gin(tag_ids);
CREATE INDEX public_entries_feed_idx ON public_entries(first_published_at DESC, entry_id);

-- Which media is used where. Rebuilt on every save / publish of an entry.
CREATE TABLE media_usage (
  asset_id      uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  owner_kind    text NOT NULL CHECK (owner_kind IN ('entry', 'settings', 'profile')),
  owner_id      text NOT NULL,
  in_draft      boolean NOT NULL DEFAULT false,
  in_published  boolean NOT NULL DEFAULT false,
  PRIMARY KEY (asset_id, owner_kind, owner_id)
);
CREATE INDEX media_usage_owner_idx ON media_usage(owner_kind, owner_id);

CREATE TABLE redirects (
  from_path   text PRIMARY KEY,
  to_path     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE preview_tokens (
  token_hash  text PRIMARY KEY,
  entry_id    uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────── Contact, audit, limits ─────────────────────
CREATE TABLE contact_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  email            text NOT NULL,
  reason           text,
  message          text NOT NULL,
  status           text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  delivery_status  text NOT NULL DEFAULT 'stored' CHECK (delivery_status IN ('stored', 'delivered', 'failed')),
  delivery_error   text,
  keep             boolean NOT NULL DEFAULT false,
  request_key      text UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  action       text NOT NULL,
  object_type  text NOT NULL,
  object_id    text,
  detail       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_created_idx ON audit_events(created_at DESC);

CREATE TABLE rate_limits (
  key           text PRIMARY KEY,
  window_start  timestamptz NOT NULL,
  count         integer NOT NULL
);

CREATE TABLE ops_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind        text NOT NULL,          -- upload_failed, publish_failed, contact_delivery_failed, ...
  object_id   text,
  message     text NOT NULL,
  resolved    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
