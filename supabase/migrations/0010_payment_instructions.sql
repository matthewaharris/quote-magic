-- Manual payments bridge: contractors tell customers how to pay them
-- (Zelle, check, their own payment link…) and record payments by hand.
-- Online payment collection (Stripe Connect) is a future mode — see
-- src/lib/payments.ts.

alter table public.contractors
  add column if not exists payment_instructions text;

-- 0004 trust rule: columns the app writes via the user-scoped client need
-- explicit grants (column grants are additive).
grant update (payment_instructions) on public.contractors to authenticated;
