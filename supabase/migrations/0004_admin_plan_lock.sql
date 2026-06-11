-- 0004: admin flag, per-contractor trial quote limit, 'disabled' plan, and
-- column-scoped write privileges on contractors.
-- The RLS policy (0001) restricts WHICH rows a user can touch; these grants
-- restrict WHICH COLUMNS. The service role bypasses both.

alter table public.contractors
  add column if not exists is_admin boolean not null default false,
  add column if not exists trial_quote_limit int not null default 25;

-- The plan check was created inline in 0003, so its name is auto-generated —
-- discover and drop it before re-adding with 'disabled' included.
do $$
declare cname text;
begin
  select conname into cname from pg_constraint
  where conrelid = 'public.contractors'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%plan%';
  if cname is not null then
    execute format('alter table public.contractors drop constraint %I', cname);
  end if;
end $$;
alter table public.contractors add constraint contractors_plan_check
  check (plan in ('trial', 'comp', 'paid', 'disabled'));

-- Column-scoped UPDATE: only the columns the app writes through the
-- user-scoped client. Locked out: plan, trial_ends_at, is_admin,
-- trial_quote_limit, logo_url (service-role only), id, created_at.
revoke update on table public.contractors from authenticated, anon;
grant update (auth_user_id, email, name, business_name, trade, phone,
              hourly_rate, website_url, onboarded_at)
  on public.contractors to authenticated;

-- Same hole for INSERT (a user could create their row pre-set to comp).
-- The first-login upsert only ever inserts these two columns; everything
-- else comes from column defaults.
revoke insert on table public.contractors from authenticated, anon;
grant insert (auth_user_id, email) on public.contractors to authenticated;

-- The app never deletes contractor rows from the client.
revoke delete on table public.contractors from authenticated, anon;

update public.contractors set is_admin = true
where email in ('mharris26@gmail.com', 'matthew.harris.ok@gmail.com');
