-- 0008: Stripe billing — paid plan tiers (Solo/Pro), Stripe linkage, and the
-- current billing period start used for monthly quote quotas.
-- NO grants here on purpose: 0004 revoked table-level UPDATE/INSERT and granted
-- specific columns, so these new columns are service-role only by default.
-- All writes go through the Stripe webhook/sync path (admin client).

alter table public.contractors
  add column if not exists plan_tier text
    check (plan_tier in ('solo', 'pro')),
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists billing_period_start timestamptz;

-- Webhook lookup key; one contractor per Stripe customer.
create unique index if not exists contractors_stripe_customer_id_key
  on public.contractors (stripe_customer_id)
  where stripe_customer_id is not null;
