-- Global app settings (singleton row, service-role only). First setting:
-- trial_days — the trial length applied to NEW signups (existing contractors'
-- trial_ends_at is set at creation and never revisited). Read by
-- src/lib/settings.ts via the service-role client; written only through the
-- /admin server action. RLS is enabled with NO policies, so the user-scoped
-- client can neither read nor write it — only the service role (which bypasses
-- RLS) can touch it.
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  trial_days int not null default 14 check (trial_days between 1 and 365),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

alter table public.app_settings enable row level security;
-- No policies on purpose: only service-role access.
