-- The household's weekly planning day. Setting it creates (or moves) a family routine,
-- "Plan the week together", on that weekday, so it shows up on everyone's Today list.

alter table public.households
  add column if not exists planning_day smallint not null default 0 check (planning_day between 0 and 6), -- 0 = Sunday
  add column if not exists planning_routine_id uuid references public.routines (id) on delete set null;

create function public.set_planning_day(hid uuid, day int) returns void
language plpgsql security definer set search_path = public as $$
declare
  cat uuid;
  rid uuid;
  on_day jsonb := jsonb_build_object('type', 'weekdays', 'days', jsonb_build_array(day));
begin
  if not public.is_member(hid) then raise exception 'Not a member of this household'; end if;
  if day < 0 or day > 6 then raise exception 'Planning day must be 0 (Sunday) to 6 (Saturday)'; end if;

  update public.households set planning_day = day where id = hid returning planning_routine_id into rid;

  -- Already have the task: just move it to the new day.
  if rid is not null and exists (select 1 from public.routines where id = rid and archived_at is null) then
    update public.routines set schedule = on_day where id = rid;
    return;
  end if;

  -- Otherwise create it. No assignees: unassigned family routines are on everyone's list.
  select id into cat from public.routine_categories
  where household_id = hid and visibility = 'family' and name = 'Family planning'
  limit 1;
  if cat is null then
    insert into public.routine_categories (household_id, owner_id, visibility, name, icon)
    values (hid, auth.uid(), 'family', 'Family planning', '⛵')
    returning id into cat;
  end if;

  insert into public.routines (category_id, household_id, name, schedule, weight, time_of_day)
  values (cat, hid, 'Plan the week together', on_day, 3, 'anytime')
  returning id into rid;

  update public.households set planning_routine_id = rid where id = hid;
end;
$$;

revoke execute on function public.set_planning_day(uuid, int) from anon;

-- Changes to the planning day reach every family member live.
alter publication supabase_realtime add table public.households;
