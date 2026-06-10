-- Post-acceptance job lifecycle: scheduling, completion, invoicing, payment.

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.quotes(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  status text not null default 'unscheduled'
    check (status in ('unscheduled','scheduled','done_reported','confirmed','invoiced','paid')),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  done_reported_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index jobs_contractor_idx on public.jobs (contractor_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  number text not null,
  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  total numeric(12,2) not null default 0,
  status text not null default 'due' check (status in ('due','paid')),
  issued_at timestamptz not null default now(),
  due_at timestamptz not null,
  paid_at timestamptz,
  payment_ref text
);
create index invoices_quote_idx on public.invoices (quote_id);

alter table public.jobs enable row level security;
alter table public.invoices enable row level security;

create policy "own jobs" on public.jobs
  for all using (contractor_id in (select id from public.contractors where auth_user_id = auth.uid()))
  with check (contractor_id in (select id from public.contractors where auth_user_id = auth.uid()));

create policy "own invoices" on public.invoices
  for all using (quote_id in (
    select q.id from public.quotes q
    join public.contractors c on c.id = q.contractor_id
    where c.auth_user_id = auth.uid()))
  with check (quote_id in (
    select q.id from public.quotes q
    join public.contractors c on c.id = q.contractor_id
    where c.auth_user_id = auth.uid()));

alter table public.quote_events drop constraint quote_events_type_check;
alter table public.quote_events add constraint quote_events_type_check
  check (type in ('created','sent','viewed','accepted','declined','edited',
                  'scheduled','done_reported','confirmed','invoiced','paid'));
