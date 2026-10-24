-- Weekly planning: routines and project steps placed on days, a meal backlog with a dinner
-- per day, and a household grocery list where every item is either "have" or "need".

-- ---------------------------------------------------------------------------
-- Routines: per-day changes to the usual schedule
-- ---------------------------------------------------------------------------

-- One row = "on this date, this routine is (not) on the plan", optionally with a different person.
-- assignee_id null means the routine's usual people. Days without a row follow the schedule.
create table public.routine_plans (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  plan_date date not null,
  planned boolean not null default true,
  assignee_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (routine_id, plan_date)
);

create index routine_plans_household_date on public.routine_plans (household_id, plan_date);

-- ---------------------------------------------------------------------------
-- Projects: the day a step is planned for (separate from its due date)
-- ---------------------------------------------------------------------------

alter table public.project_items add column if not exists planned_date date;

-- ---------------------------------------------------------------------------
-- Meals: a backlog of meals, and one dinner per day
-- ---------------------------------------------------------------------------

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  icon text not null default '🍽️',
  ingredients text[] not null default '{}',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  meal_id uuid not null references public.meals (id) on delete cascade,
  plan_date date not null,
  cook_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (household_id, plan_date)
);

-- ---------------------------------------------------------------------------
-- Groceries: one long household list; each item is either "have" or "need"
-- ---------------------------------------------------------------------------

create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  status text not null default 'need' check (status in ('have', 'need')),
  -- What it's needed for, e.g. a planned meal ("Tacos"). Cleared once you have it.
  for_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index grocery_items_name on public.grocery_items (household_id, lower(name));

create trigger grocery_items_touch before insert or update on public.grocery_items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.routine_plans enable row level security;
alter table public.meals enable row level security;
alter table public.meal_plans enable row level security;
alter table public.grocery_items enable row level security;

-- Anyone who can see a routine can plan it.
create policy routine_plans_all on public.routine_plans for all
  using (public.can_access_routine(routine_id))
  with check (
    public.can_access_routine(routine_id)
    and household_id = (select r.household_id from public.routines r where r.id = routine_id)
  );

-- Meals and groceries are shared by the whole household.
create policy meals_all on public.meals for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy meal_plans_all on public.meal_plans for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy grocery_items_all on public.grocery_items for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));

-- ---------------------------------------------------------------------------
-- Removing a member also clears them from plans
-- ---------------------------------------------------------------------------

create or replace function public.remove_member(hid uuid, member uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only the household owner can remove members';
  end if;
  if member = auth.uid() then raise exception 'You cannot remove yourself'; end if;

  delete from public.household_members where household_id = hid and user_id = member;

  update public.routines
  set assignee_ids = array_remove(assignee_ids, member),
      day_assignees = coalesce(
        (select jsonb_object_agg(key, value) from jsonb_each_text(day_assignees) where value <> member::text),
        '{}'::jsonb
      )
  where household_id = hid
    and (member = any(assignee_ids) or day_assignees::text like '%' || member::text || '%');

  update public.project_items set assignee_id = null where household_id = hid and assignee_id = member;
  update public.routine_plans set assignee_id = null where household_id = hid and assignee_id = member;
  update public.meal_plans set cook_id = null where household_id = hid and cook_id = member;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.routine_plans,
  public.meals,
  public.meal_plans,
  public.grocery_items;
