-- Privacy moves from categories to items: any routine or to-do can be tagged personal.
-- private_to = the only person who can see it (null = shared with the household).

alter table public.routines
  add column if not exists private_to uuid references public.profiles (id) on delete cascade;
alter table public.project_items
  add column if not exists private_to uuid references public.profiles (id) on delete cascade;

-- Items in the old personal categories become personal items, owned by that person.
-- (The categories themselves stay visible only to their owner, so their names don't leak.)
update public.routines r
set private_to = c.owner_id, assignee_ids = array[c.owner_id]
from public.routine_categories c
where c.id = r.category_id and c.visibility = 'personal';

update public.project_items i
set private_to = p.owner_id, assignee_id = p.owner_id
from public.projects p
where p.id = i.project_id and p.visibility = 'personal';

-- Logs and plans follow the routine: you only see them for routines you can see.
create or replace function public.can_access_routine(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.routines r
    join public.routine_categories c on c.id = r.category_id
    where r.id = rid
      and (r.private_to is null or r.private_to = auth.uid())
      and public.can_access(c.household_id, c.visibility, c.owner_id)
  );
$$;

drop policy if exists routines_all on public.routines;
create policy routines_all on public.routines for all
  using (
    (private_to is null or private_to = auth.uid())
    and exists (
      select 1 from public.routine_categories c
      where c.id = category_id and c.household_id = routines.household_id
        and public.can_access(c.household_id, c.visibility, c.owner_id)
    )
  )
  with check (
    (private_to is null or private_to = auth.uid())
    and exists (
      select 1 from public.routine_categories c
      where c.id = category_id and c.household_id = routines.household_id
        and public.can_access(c.household_id, c.visibility, c.owner_id)
    )
  );

drop policy if exists items_all on public.project_items;
create policy items_all on public.project_items for all
  using ((private_to is null or private_to = auth.uid()) and public.can_access_project(project_id))
  with check ((private_to is null or private_to = auth.uid()) and public.can_access_project(project_id));
