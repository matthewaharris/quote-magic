-- Contractor-defined availability drives customer self-scheduling:
-- per-day working hours, pre-existing commitments (busy blocks), and a
-- per-quote duration override (buffer / drive time) on top of labor hours.

-- Weekly hours keyed by day-of-week "0" (Sunday) … "6" (Saturday).
-- A missing/null day means closed. Times are HH:MM wall-clock (same UTC
-- wall-clock convention as scheduled_start — see src/lib/scheduling.ts).
-- Default matches the old hardcoded Mon–Fri 8–17 behavior.
alter table public.contractors
  add column if not exists availability jsonb not null default
    '{"1":{"start":"08:00","end":"17:00"},"2":{"start":"08:00","end":"17:00"},"3":{"start":"08:00","end":"17:00"},"4":{"start":"08:00","end":"17:00"},"5":{"start":"08:00","end":"17:00"}}';

-- 0004 trust rule: columns the app writes via the user-scoped client need
-- explicit grants (column grants are additive).
grant update (availability) on public.contractors to authenticated;

-- Slot length for scheduling: derived from labor hours unless the
-- contractor overrides it on the quote (buffer, drive time, multi-day pad).
alter table public.quotes
  add column if not exists duration_override_minutes int
    check (duration_override_minutes is null or duration_override_minutes between 30 and 1440);

-- Pre-existing appointments / personal commitments that block the calendar
-- alongside booked jobs. Timestamps follow the UTC wall-clock convention.
create table if not exists public.busy_blocks (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  title text not null default 'Busy',
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint busy_blocks_range check (end_at > start_at)
);
create index if not exists busy_blocks_contractor_idx
  on public.busy_blocks (contractor_id, start_at);

alter table public.busy_blocks enable row level security;
create policy "own busy blocks" on public.busy_blocks
  for all using (contractor_id in (select id from public.contractors where auth_user_id = auth.uid()))
  with check (contractor_id in (select id from public.contractors where auth_user_id = auth.uid()));

-- Customer-initiated rebooking of a scheduled job.
alter table public.quote_events drop constraint quote_events_type_check;
alter table public.quote_events add constraint quote_events_type_check
  check (type in ('created', 'sent', 'viewed', 'accepted', 'declined', 'edited',
    'scheduled', 'rescheduled', 'done_reported', 'confirmed', 'invoiced', 'paid',
    'deposit_paid', 'nudged',
    'change_order_added', 'change_order_approved', 'change_order_declined'));
