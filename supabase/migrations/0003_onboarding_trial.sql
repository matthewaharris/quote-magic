-- Onboarding rework + trial fields.
-- name = contractor's personal name; business_name becomes optional company name.
alter table public.contractors
  add column if not exists name text not null default '',
  add column if not exists logo_url text,
  add column if not exists website_url text,
  add column if not exists plan text not null default 'trial'
    check (plan in ('trial', 'comp', 'paid')),
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '14 days');

-- Public bucket for scraped/uploaded contractor logos. Uploads go through the
-- service-role client (bypasses storage RLS); public reads need no policy.
-- Contractors active before onboarded_at existed as a gate (they have a
-- business name or price book) shouldn't be funneled into onboarding.
update public.contractors c
set onboarded_at = c.created_at
where c.onboarded_at is null
  and (c.business_name <> ''
    or exists (select 1 from public.price_book_items p where p.contractor_id = c.id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
        'image/x-icon', 'image/vnd.microsoft.icon'])
on conflict (id) do nothing;
