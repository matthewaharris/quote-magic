-- 0005: deposits on acceptance, change orders, good/better/best tiers,
-- referral tracking, and the quote_events types they need.

-- ===== Deposits =====
alter table public.contractors
  add column if not exists deposit_percent int not null default 25
    check (deposit_percent between 0 and 100);
-- 0004 trust rule: new contractor columns the app writes via the user-scoped
-- client must be explicitly granted (column grants are additive).
grant update (deposit_percent) on public.contractors to authenticated;

alter table public.jobs
  add column if not exists deposit_amount numeric(12,2) not null default 0,
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists deposit_ref text;

-- Invoice transparency: what was added/subtracted at issue time.
alter table public.invoices
  add column if not exists deposit_applied numeric(12,2) not null default 0,
  add column if not exists change_orders_total numeric(12,2) not null default 0;

-- ===== Change orders =====
create table public.change_orders (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  title text not null,
  description text,
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index change_orders_quote_idx on public.change_orders (quote_id);

alter table public.change_orders enable row level security;
create policy "own change orders" on public.change_orders
  for all using (contractor_id in
    (select id from public.contractors where auth_user_id = auth.uid()))
  with check (contractor_id in
    (select id from public.contractors where auth_user_id = auth.uid()));
-- Customer approve/decline goes through the service-role client.

-- ===== Good / better / best =====
alter table public.quotes
  add column if not exists tier_group_id uuid,
  add column if not exists tier text check (tier in ('good', 'better', 'best'));
create index quotes_tier_group_idx on public.quotes (tier_group_id)
  where tier_group_id is not null;

-- ===== Referrals =====
-- referred_by is intentionally NOT granted to authenticated — it is written
-- via the service-role client inside completeOnboarding.
alter table public.contractors
  add column if not exists referred_by uuid references public.contractors(id);

-- ===== New event types (constraint was re-created by name in 0002) =====
alter table public.quote_events drop constraint quote_events_type_check;
alter table public.quote_events add constraint quote_events_type_check
  check (type in ('created', 'sent', 'viewed', 'accepted', 'declined', 'edited',
    'scheduled', 'done_reported', 'confirmed', 'invoiced', 'paid',
    'deposit_paid', 'nudged',
    'change_order_added', 'change_order_approved', 'change_order_declined'));
