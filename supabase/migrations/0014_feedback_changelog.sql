-- In-app feedback (bug reports / feature requests) and an admin-authored
-- "What's new" changelog.

-- ── Feedback ───────────────────────────────────────────────────────────────
-- Contractors submit bug reports / feature requests from inside the app; the
-- owner triages them in /admin/feedback. A contractor can create and read
-- their OWN rows (so we can later show "you reported this, it shipped"), but
-- never update them — status/admin_notes are owner-only, written through the
-- service-role client (which bypasses RLS). No update/delete policy exists, so
-- the user-scoped client is denied those by default-deny RLS.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  type text not null default 'other' check (type in ('bug', 'feature', 'other')),
  message text not null,
  page_url text,
  status text not null default 'open'
    check (status in ('open', 'planned', 'in_progress', 'done', 'declined')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists feedback_status_idx
  on public.feedback (status, created_at desc);
create index if not exists feedback_contractor_idx
  on public.feedback (contractor_id, created_at desc);

alter table public.feedback enable row level security;
-- Own rows only, and only insert + select — no update/delete policy on purpose.
create policy "insert own feedback" on public.feedback
  for insert
  with check (contractor_id in
    (select id from public.contractors where auth_user_id = auth.uid()));
create policy "read own feedback" on public.feedback
  for select
  using (contractor_id in
    (select id from public.contractors where auth_user_id = auth.uid()));

-- ── Changelog ──────────────────────────────────────────────────────────────
-- Owner-authored release notes shown in the in-app "What's new" panel.
-- published_at null = draft (invisible to users); set = live. Authored only
-- through the service-role client in /admin/changelog. Any signed-in user may
-- READ published entries; no insert/update/delete policy, so the user-scoped
-- client cannot write.
create table if not exists public.changelog_entries (
  id uuid primary key default gen_random_uuid(),
  version text,
  title text not null,
  body text not null default '',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists changelog_published_idx
  on public.changelog_entries (published_at desc);

alter table public.changelog_entries enable row level security;
create policy "read published changelog" on public.changelog_entries
  for select
  using (published_at is not null);

-- Per-contractor "last seen the What's new panel" marker. Drives the unseen
-- dot. Written by the user-scoped client, so it needs an explicit column grant
-- on top of the 0004 lockdown (contractors revoked default UPDATE).
alter table public.contractors
  add column if not exists changelog_seen_at timestamptz;
grant update (changelog_seen_at) on public.contractors to authenticated;
