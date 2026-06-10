-- QuoteMagic initial schema
create extension if not exists pgcrypto;

create table public.contractors (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null default '',
  trade text not null default '',
  phone text,
  email text,
  hourly_rate numeric(10,2) not null default 100,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.price_book_items (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  name text not null,
  description text,
  category text,
  unit text not null default 'each',
  unit_cost numeric(10,2) not null default 0,
  default_qty numeric(10,2) not null default 1,
  est_minutes_per_unit integer not null default 0,
  source text not null default 'manual' check (source in ('seeded','learned','manual')),
  created_at timestamptz not null default now()
);
create index price_book_items_contractor_idx on public.price_book_items (contractor_id);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now()
);
create index customers_contractor_idx on public.customers (contractor_id);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','sent','viewed','accepted','declined')),
  title text not null default 'Untitled quote',
  job_summary text,
  dictation_transcript text,
  share_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  total numeric(12,2) not null default 0,
  est_total_minutes integer not null default 0,
  assumptions jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index quotes_contractor_idx on public.quotes (contractor_id);
create index quotes_share_token_idx on public.quotes (share_token);

create table public.quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  price_book_item_id uuid references public.price_book_items(id) on delete set null,
  name text not null,
  description text,
  qty numeric(10,2) not null default 1,
  unit text not null default 'each',
  unit_price numeric(10,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  est_minutes integer not null default 0,
  ai_confidence numeric(3,2),
  is_new_item boolean not null default false,
  sort_order integer not null default 0
);
create index quote_line_items_quote_idx on public.quote_line_items (quote_id);

create table public.quote_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  type text not null check (type in ('created','sent','viewed','accepted','declined','edited')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index quote_events_quote_idx on public.quote_events (quote_id);

-- Row level security: contractors see only their own data.
-- The public customer quote page never hits these tables directly with the
-- anon key; it goes through server routes using the service role.
alter table public.contractors enable row level security;
alter table public.price_book_items enable row level security;
alter table public.customers enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_line_items enable row level security;
alter table public.quote_events enable row level security;

create policy "own contractor row" on public.contractors
  for all using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

create policy "own price book" on public.price_book_items
  for all using (contractor_id in (select id from public.contractors where auth_user_id = auth.uid()))
  with check (contractor_id in (select id from public.contractors where auth_user_id = auth.uid()));

create policy "own customers" on public.customers
  for all using (contractor_id in (select id from public.contractors where auth_user_id = auth.uid()))
  with check (contractor_id in (select id from public.contractors where auth_user_id = auth.uid()));

create policy "own quotes" on public.quotes
  for all using (contractor_id in (select id from public.contractors where auth_user_id = auth.uid()))
  with check (contractor_id in (select id from public.contractors where auth_user_id = auth.uid()));

create policy "own quote line items" on public.quote_line_items
  for all using (quote_id in (
    select q.id from public.quotes q
    join public.contractors c on c.id = q.contractor_id
    where c.auth_user_id = auth.uid()))
  with check (quote_id in (
    select q.id from public.quotes q
    join public.contractors c on c.id = q.contractor_id
    where c.auth_user_id = auth.uid()));

create policy "own quote events" on public.quote_events
  for all using (quote_id in (
    select q.id from public.quotes q
    join public.contractors c on c.id = q.contractor_id
    where c.auth_user_id = auth.uid()))
  with check (quote_id in (
    select q.id from public.quotes q
    join public.contractors c on c.id = q.contractor_id
    where c.auth_user_id = auth.uid()));
