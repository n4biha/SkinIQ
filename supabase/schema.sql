-- SkinIQ database schema (Phase C).
-- Paste this whole file into the Supabase SQL Editor and press "Run".
-- It is safe to re-run: every statement uses "if not exists".
--
-- Security model: Row Level Security (RLS) is ENABLED on every table but we add
-- NO public policies. That means the public "anon" key can't read or write
-- anything — the database is locked down by default. Our Next.js server talks to
-- Supabase with the secret "service_role" key, which bypasses RLS. So all access
-- goes through our server, which is exactly what we want for now. (User-scoped
-- policies + login come later, in part C5.)

-- gen_random_uuid() comes from this extension (usually already enabled).
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles — a saved skin profile. user_id is a plain text id for now
-- (anonymous / per-device). Real auth arrives in C5.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id         uuid primary key default gen_random_uuid(),
  user_id    text,
  skin_type  text,
  concerns   text[] not null default '{}',
  allergies  text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- scans — one row per uploaded photo. image_url points at the file we store in
-- Supabase Storage (wired in C3).
-- ---------------------------------------------------------------------------
create table if not exists scans (
  id         uuid primary key default gen_random_uuid(),
  user_id    text,
  image_url  text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- results — the analyzed report for a scan. The scored numbers + Gemini prose.
-- jsonb columns hold our arrays/objects (ingredients, highlights, etc.) as-is.
-- ---------------------------------------------------------------------------
create table if not exists results (
  id             uuid primary key default gen_random_uuid(),
  scan_id        uuid references scans(id) on delete cascade,
  product_name   text,
  overall_score  numeric,
  verdict        text,
  summary        text,
  ingredients    jsonb,
  highlights     jsonb,
  cautions       jsonb,
  benefits       jsonb,
  concern_scores jsonb,
  how_to_use     text,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ingredients — the persistent home for the resolver's Tier-2 (CosIng) data and
-- Tier-3 (Gemini) cache. Keyed by normalized INCI name. Filled in C6.
-- ---------------------------------------------------------------------------
create table if not exists ingredients (
  inci_name    text primary key,
  display      text,
  function     text,
  benefits_for jsonb,
  comedogenic  int,
  is_irritant  boolean,
  is_fragrance boolean,
  note         text,
  source       text,                 -- 'curated' | 'cosing' | 'gemini'
  created_at   timestamptz not null default now()
);

-- Lock everything down by default (server service-role key bypasses this).
alter table profiles    enable row level security;
alter table scans       enable row level security;
alter table results     enable row level security;
alter table ingredients enable row level security;

-- ---------------------------------------------------------------------------
-- Storage: a PRIVATE bucket for uploaded label photos. Not public — the server
-- mints short-lived signed URLs to display them. (Service-role uploads/reads
-- bypass Storage RLS, so no extra policies are needed.)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('scans', 'scans', false)
on conflict (id) do nothing;
