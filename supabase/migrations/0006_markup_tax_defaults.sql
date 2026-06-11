-- Per-contractor pricing defaults, seeded into every new quote:
-- markup is baked into line unit prices at generation (customers never see
-- a "markup" row); tax_rate fills the quote's existing tax field.
-- default_tax_rate is the future home of a zip-code tax lookup.
alter table public.contractors
  add column if not exists default_markup_percent numeric(5,2) not null default 0
    check (default_markup_percent between 0 and 100),
  add column if not exists default_tax_rate numeric(5,2) not null default 0
    check (default_tax_rate between 0 and 25);

-- 0004 trust rule: columns the app writes via the user-scoped client need
-- explicit grants (column grants are additive).
grant update (default_markup_percent, default_tax_rate)
  on public.contractors to authenticated;
