-- gen_random_uuid() comes from this extension (usually already enabled).
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles — a saved skin profile, one per signed-in user (user_id = the
-- Supabase auth user id). Unique on user_id so we can upsert it.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id         uuid primary key default gen_random_uuid(),
  user_id    text unique,
  skin_type  text,
  sensitive  boolean not null default false,
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
  user_id        text,
  share_token    text,                 -- null = private; set = opt-in public link
  scan_id        uuid references scans(id) on delete cascade,
  product_name   text,
  category       text,                 -- product type (best-effort); null → "other"
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
-- ingredients — persistent Tier-3 (Gemini) cache, keyed by normalized INCI name.
-- Graded shape: `helps` is a jsonb map of concern -> "strong"|"moderate".
-- So each ingredient is graded by the model once, then reused forever (C6).
-- ---------------------------------------------------------------------------
create table if not exists ingredients (
  inci_name   text primary key,
  display     text,
  function    text,
  helps       jsonb   not null default '{}'::jsonb,
  irritation  text    not null default 'none',
  comedogenic int     not null default 0,
  fragrance   boolean not null default false,
  note        text,
  source      text,                  -- 'gemini'
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Migrations for already-created tables ("create table if not exists" above
-- won't alter an existing table). All idempotent — safe to re-run.
-- ---------------------------------------------------------------------------
alter table results  add column if not exists user_id text;
alter table profiles add column if not exists sensitive boolean not null default false;
-- ingredients: migrate the pre-grading shape to the graded one (table is a cache).
alter table ingredients add column if not exists helps      jsonb   not null default '{}'::jsonb;
alter table ingredients add column if not exists irritation text    not null default 'none';
alter table ingredients add column if not exists fragrance  boolean not null default false;
alter table ingredients drop column if exists benefits_for;
alter table ingredients drop column if exists is_irritant;
alter table ingredients drop column if exists is_fragrance;
create index if not exists results_user_id_idx on results(user_id);
create index if not exists scans_user_id_idx   on scans(user_id);
create unique index if not exists profiles_user_id_key on profiles(user_id);
-- Opt-in share links look reports up by this unguessable token (unique; many NULLs ok).
alter table results add column if not exists share_token text;
create unique index if not exists results_share_token_key on results(share_token);
alter table results add column if not exists category text;

-- Lock everything down by default (server service-role key bypasses this).
alter table profiles    enable row level security;
alter table scans       enable row level security;
alter table results     enable row level security;
alter table ingredients enable row level security;

-- ---------------------------------------------------------------------------
-- Per-user access policies: an authenticated user may touch only their own rows
-- (user_id = their auth uid). Defense-in-depth — the server uses the service-role
-- key which BYPASSES RLS, so app behavior is unchanged. `ingredients` stays
-- policy-less (shared cache, reachable only via the service-role server).
-- ---------------------------------------------------------------------------
drop policy if exists own_profiles on profiles;
create policy own_profiles on profiles for all to authenticated
  using ((select auth.uid())::text = user_id)
  with check ((select auth.uid())::text = user_id);

drop policy if exists own_scans on scans;
create policy own_scans on scans for all to authenticated
  using ((select auth.uid())::text = user_id)
  with check ((select auth.uid())::text = user_id);

drop policy if exists own_results on results;
create policy own_results on results for all to authenticated
  using ((select auth.uid())::text = user_id)
  with check ((select auth.uid())::text = user_id);

-- ---------------------------------------------------------------------------
-- Storage: a PRIVATE bucket for uploaded label photos. Not public — the server
-- mints short-lived signed URLs to display them. (Service-role uploads/reads
-- bypass Storage RLS, so no extra policies are needed.)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('scans', 'scans', false)
on conflict (id) do nothing;
