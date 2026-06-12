-- Zip-code sales tax lookup (the "future home" promised in 0006):
-- contractors.business_zip drives the default-rate lookup in /settings;
-- quotes.job_zip (spoken in the dictation or typed in the editor) drives a
-- per-quote rate. Rates come from the zip.tax API via src/lib/tax.ts and a
-- shared cross-contractor cache table.

alter table public.contractors
  add column if not exists business_zip text
    check (business_zip is null or business_zip ~ '^[0-9]{5}$');

-- 0004 trust rule: columns the app writes via the user-scoped client need
-- explicit grants (column grants are additive).
grant update (business_zip) on public.contractors to authenticated;

alter table public.quotes
  add column if not exists job_zip text
    check (job_zip is null or job_zip ~ '^[0-9]{5}$');

-- Cache of zip -> combined sales tax rate, in PERCENT (e.g. 8.250 = 8.25%).
-- Shared across contractors (public data); read/written only through the
-- service role — RLS on with no policies locks out user-scoped clients.
create table if not exists public.tax_rates (
  zip text primary key check (zip ~ '^[0-9]{5}$'),
  rate numeric(6, 3) not null check (rate >= 0 and rate <= 25),
  region text,
  fetched_at timestamptz not null default now()
);
alter table public.tax_rates enable row level security;
revoke all on table public.tax_rates from authenticated, anon;
