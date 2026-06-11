-- Per-contractor freeform quoting rules, injected into every AI generation.
alter table public.contractors
  add column if not exists quoting_instructions text;

-- 0004 trust rule: user-client-writable columns need explicit grants.
grant update (quoting_instructions) on public.contractors to authenticated;
