-- Per-day responsibility for family routines (e.g. "Pick up baby": Mon → Ehsan, Tue → Sara).
-- Maps weekday ("0" = Sunday … "6" = Saturday) to the user id responsible that day.
-- When empty, the routine's assignee_ids apply to every day as before.
alter table public.routines
  add column if not exists day_assignees jsonb not null default '{}'::jsonb;
