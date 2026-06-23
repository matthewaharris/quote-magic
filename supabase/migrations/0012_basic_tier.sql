-- Basic tier ($9, 10 quotes) for the funnel: a cheaper entry point that
-- converts post-trial low-commitment users. Differentiated by quote volume,
-- a "Powered by QuoteMagic" badge (no white-label), and no AI bulk import.
-- Widen the plan_tier check from 0008 to allow 'basic'.

alter table public.contractors
  drop constraint if exists contractors_plan_tier_check;

alter table public.contractors
  add constraint contractors_plan_tier_check
    check (plan_tier in ('basic', 'solo', 'pro'));
