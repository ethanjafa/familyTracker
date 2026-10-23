-- Family Tracker: initial schema
-- Personal items are visible only to their owner; family items to every household member.
-- All access is enforced with Row Level Security.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Profiles & households
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  color text not null default '#208AEF',
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'adult' check (role in ('owner', 'adult')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.invites (
  code text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

-- Create a profile automatically when someone signs up (Google/Apple metadata).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1),
      'Me'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Access helpers (security definer so policies don't recurse)
-- ---------------------------------------------------------------------------

create function public.is_member(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

create function public.can_access(hid uuid, vis text, owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_member(hid) and (vis = 'family' or owner = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Routines: category (level 1) -> routine (level 2) -> logs
-- ---------------------------------------------------------------------------

create table public.routine_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  visibility text not null check (visibility in ('personal', 'family')),
  name text not null,
  icon text not null default '✅',
  color text not null default '#208AEF',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.routine_categories (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  -- {"type":"daily"} | {"type":"weekdays","days":[1,3,5]} | {"type":"weekly","times":3}
  -- | {"type":"monthly","times":2} | {"type":"interval","every":3}
  schedule jsonb not null default '{"type":"daily"}',
  weight int not null default 2 check (weight between 1 and 3),
  time_of_day text not null default 'anytime' check (time_of_day in ('morning', 'day', 'evening', 'anytime')),
  assignee_ids uuid[] not null default '{}',
  start_date date not null default current_date,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create function public.can_access_routine(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.routines r
    join public.routine_categories c on c.id = r.category_id
    where r.id = rid and public.can_access(c.household_id, c.visibility, c.owner_id)
  );
$$;

-- One log per routine per day; whoever did it is recorded in user_id.
create table public.routine_logs (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  log_date date not null,
  status text not null check (status in ('done', 'partial', 'skipped')),
  note text,
  created_at timestamptz not null default now(),
  unique (routine_id, log_date)
);

create index routine_logs_household_date on public.routine_logs (household_id, log_date);

-- ---------------------------------------------------------------------------
-- Projects: project (level 1) -> items (level 2)
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  visibility text not null check (visibility in ('personal', 'family')),
  name text not null,
  description text,
  icon text not null default '🛠️',
  color text not null default '#208AEF',
  status text not null default 'active' check (status in ('active', 'on_hold', 'done')),
  target_date date,
  budget numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.can_access_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = pid and public.can_access(p.household_id, p.visibility, p.owner_id)
  );
$$;

create table public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null,
  notes text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done')),
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date date,
  cost numeric(12, 2),
  sort_order int not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  if tg_table_name = 'project_items' then
    if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
      new.completed_at = now();
    elsif new.status <> 'done' then
      new.completed_at = null;
    end if;
  end if;
  return new;
end;
$$;

create trigger projects_touch before insert or update on public.projects
  for each row execute function public.touch_updated_at();
create trigger project_items_touch before insert or update on public.project_items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.invites enable row level security;
alter table public.routine_categories enable row level security;
alter table public.routines enable row level security;
alter table public.routine_logs enable row level security;
alter table public.projects enable row level security;
alter table public.project_items enable row level security;

-- Profiles: yourself and anyone you share a household with.
create policy profiles_select on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  )
);
create policy profiles_update on public.profiles for update using (id = auth.uid());

-- Households / members: members can read. Creation & joining go through RPCs below.
create policy households_select on public.households for select using (public.is_member(id));
create policy households_update on public.households for update using (public.is_member(id));
create policy members_select on public.household_members for select using (public.is_member(household_id));
create policy members_delete_self on public.household_members for delete using (user_id = auth.uid());
create policy invites_select on public.invites for select using (public.is_member(household_id));

-- Categories & projects: personal = owner only, family = all members.
create policy categories_select on public.routine_categories for select
  using (public.can_access(household_id, visibility, owner_id));
create policy categories_insert on public.routine_categories for insert
  with check (owner_id = auth.uid() and public.is_member(household_id));
create policy categories_update on public.routine_categories for update
  using (public.can_access(household_id, visibility, owner_id))
  with check (public.can_access(household_id, visibility, owner_id));
create policy categories_delete on public.routine_categories for delete
  using (public.can_access(household_id, visibility, owner_id));

create policy routines_all on public.routines for all
  using (exists (
    select 1 from public.routine_categories c
    where c.id = category_id and c.household_id = routines.household_id
      and public.can_access(c.household_id, c.visibility, c.owner_id)
  ))
  with check (exists (
    select 1 from public.routine_categories c
    where c.id = category_id and c.household_id = routines.household_id
      and public.can_access(c.household_id, c.visibility, c.owner_id)
  ));

-- Anyone who can see a routine can log it (or undo a log).
create policy logs_select on public.routine_logs for select using (public.can_access_routine(routine_id));
create policy logs_insert on public.routine_logs for insert
  with check (user_id = auth.uid() and public.can_access_routine(routine_id));
create policy logs_update on public.routine_logs for update
  using (public.can_access_routine(routine_id))
  with check (user_id = auth.uid() and public.can_access_routine(routine_id));
create policy logs_delete on public.routine_logs for delete using (public.can_access_routine(routine_id));

create policy projects_select on public.projects for select
  using (public.can_access(household_id, visibility, owner_id));
create policy projects_insert on public.projects for insert
  with check (owner_id = auth.uid() and public.is_member(household_id));
create policy projects_update on public.projects for update
  using (public.can_access(household_id, visibility, owner_id))
  with check (public.can_access(household_id, visibility, owner_id));
create policy projects_delete on public.projects for delete
  using (public.can_access(household_id, visibility, owner_id));

create policy items_all on public.project_items for all
  using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create function public.create_household(household_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.households (name, created_by) values (household_name, auth.uid()) returning id into hid;
  insert into public.household_members (household_id, user_id, role) values (hid, auth.uid(), 'owner');
  return hid;
end;
$$;

create function public.create_invite(hid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  new_code text;
begin
  if not public.is_member(hid) then raise exception 'Not a member of this household'; end if;
  new_code := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 6));
  insert into public.invites (code, household_id, created_by) values (new_code, hid, auth.uid());
  return new_code;
end;
$$;

create function public.join_household(invite_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select household_id into hid from public.invites
  where code = upper(trim(invite_code)) and expires_at > now();
  if hid is null then raise exception 'Invite code is invalid or expired'; end if;
  insert into public.household_members (household_id, user_id, role)
  values (hid, auth.uid(), 'adult')
  on conflict do nothing;
  return hid;
end;
$$;

revoke execute on function public.create_household(text) from anon;
revoke execute on function public.create_invite(uuid) from anon;
revoke execute on function public.join_household(text) from anon;

-- ---------------------------------------------------------------------------
-- Realtime: push changes to every signed-in family member
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.routine_categories,
  public.routines,
  public.routine_logs,
  public.projects,
  public.project_items,
  public.household_members,
  public.profiles;
