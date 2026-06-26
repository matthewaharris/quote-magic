-- Internal / test contractor accounts. Excluded from /admin stats today, and a
-- reusable primitive for keeping seed data out of future analytics/exports.
-- Toggled only from /admin via the service-role client — like is_admin (0004),
-- the column is never granted to the user client, so the 0004 table-level
-- UPDATE revoke leaves it write-locked (a test account can't promote itself
-- into the real stats). security-check.mjs covers the lock.
alter table public.contractors
  add column if not exists is_test boolean not null default false;
