-- "Join another family" (Settings): move the signed-in person into the family behind an invite
-- code. If they were the only member, they can bring everything along or start fresh; if their
-- family had others, they leave it and the family keeps everything. 🔒 Personal items always move.

create function public.switch_household(invite_code text, bring_items boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  new_hid uuid;
  old record;
  others int;
  heir uuid;
  item record;
  target uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select household_id into new_hid from public.invites
  where code = upper(trim(invite_code)) and expires_at > now();
  if new_hid is null then raise exception 'Invite code is invalid or expired'; end if;
  if exists (select 1 from public.household_members where household_id = new_hid and user_id = me) then
    raise exception 'You are already in this family';
  end if;

  for old in
    select m.household_id as id, m.role, h.planning_routine_id
    from public.household_members m join public.households h on h.id = m.household_id
    where m.user_id = me
  loop
    select count(*) into others from public.household_members where household_id = old.id and user_id <> me;

    if others = 0 and bring_items then
      -- Bring everything. The old "Plan the week together" task stays behind (the new family has one).
      delete from public.routines where id = old.planning_routine_id;
      update public.routine_categories set household_id = new_hid where household_id = old.id;
      update public.routines set household_id = new_hid where household_id = old.id;
      update public.routine_logs set household_id = new_hid where household_id = old.id;
      update public.routine_plans set household_id = new_hid where household_id = old.id;
      update public.projects set household_id = new_hid where household_id = old.id;
      update public.project_items set household_id = new_hid where household_id = old.id;
      update public.meals set household_id = new_hid where household_id = old.id;
      -- Days the new family already planned keep their meal.
      update public.meal_plans m set household_id = new_hid
      where m.household_id = old.id
        and not exists (
          select 1 from public.meal_plans p where p.household_id = new_hid and p.plan_date = m.plan_date and p.slot = m.slot
        );
      -- Groceries the new family already lists stay single; if you needed one, they now need it too.
      update public.grocery_items g set status = 'need'
      from public.grocery_items o
      where g.household_id = new_hid and o.household_id = old.id and lower(g.name) = lower(o.name) and o.status = 'need';
      update public.grocery_items o set household_id = new_hid
      where o.household_id = old.id
        and not exists (select 1 from public.grocery_items g where g.household_id = new_hid and lower(g.name) = lower(o.name));
      -- An emptied "Family planning" category isn't needed in the new family.
      delete from public.routine_categories c
      where c.household_id = new_hid and c.owner_id = me and c.name = 'Family planning'
        and not exists (select 1 from public.routines r where r.category_id = c.id);
      delete from public.households where id = old.id;
      continue;
    end if;

    -- 🔒 Personal items come with you. Old-style personal categories and to-do lists are only
    -- yours, so they move whole; personal items in shared categories go to a category of the same
    -- name in the new family (created if it doesn't have one).
    update public.routine_categories set household_id = new_hid
    where household_id = old.id and visibility = 'personal' and owner_id = me;
    update public.routines r set household_id = new_hid
    from public.routine_categories c
    where c.id = r.category_id and c.household_id = new_hid and r.household_id = old.id;
    for item in select id, category_id from public.routines where household_id = old.id and private_to = me loop
      select c2.id into target
      from public.routine_categories c2 join public.routine_categories c on c.id = item.category_id
      where c2.household_id = new_hid and lower(c2.name) = lower(c.name)
      limit 1;
      if target is null then
        insert into public.routine_categories (household_id, owner_id, visibility, name, icon)
        select new_hid, me, 'family', name, icon from public.routine_categories where id = item.category_id
        returning id into target;
      end if;
      update public.routines set household_id = new_hid, category_id = target where id = item.id;
    end loop;
    update public.routine_logs l set household_id = new_hid
    from public.routines r where r.id = l.routine_id and r.household_id = new_hid and l.household_id = old.id;
    update public.routine_plans p set household_id = new_hid
    from public.routines r where r.id = p.routine_id and r.household_id = new_hid and p.household_id = old.id;

    update public.projects set household_id = new_hid
    where household_id = old.id and visibility = 'personal' and owner_id = me;
    update public.project_items i set household_id = new_hid
    from public.projects p where p.id = i.project_id and p.household_id = new_hid and i.household_id = old.id;
    for item in select id, project_id from public.project_items where household_id = old.id and private_to = me loop
      select p2.id into target
      from public.projects p2 join public.projects p on p.id = item.project_id
      where p2.household_id = new_hid and lower(p2.name) = lower(p.name)
      limit 1;
      if target is null then
        insert into public.projects (household_id, owner_id, visibility, name, icon)
        select new_hid, me, 'family', name, icon from public.projects where id = item.project_id
        returning id into target;
      end if;
      update public.project_items set household_id = new_hid, project_id = target where id = item.id;
    end loop;

    if others = 0 then
      -- Start fresh: the old family and the rest of its data go.
      delete from public.households where id = old.id;
    else
      -- Leave: the family keeps everything shared; the next member takes over what was yours.
      select user_id into heir from public.household_members
      where household_id = old.id and user_id <> me
      order by (role = 'owner') desc, joined_at
      limit 1;
      if old.role = 'owner' then
        update public.household_members set role = 'owner' where household_id = old.id and user_id = heir;
      end if;
      update public.households set created_by = heir where id = old.id and created_by = me;
      update public.routine_categories set owner_id = heir where household_id = old.id and owner_id = me;
      update public.projects set owner_id = heir where household_id = old.id and owner_id = me;
      update public.invites set created_by = heir where household_id = old.id and created_by = me;
      update public.routines
      set assignee_ids = array_remove(assignee_ids, me),
          day_assignees = coalesce(
            (select jsonb_object_agg(key, value) from jsonb_each_text(day_assignees) where value <> me::text),
            '{}'::jsonb
          )
      where household_id = old.id
        and (me = any(assignee_ids) or day_assignees::text like '%' || me::text || '%');
      update public.project_items set assignee_id = null where household_id = old.id and assignee_id = me;
      update public.routine_plans set assignee_id = null where household_id = old.id and assignee_id = me;
      update public.meal_plans set cook_id = null where household_id = old.id and cook_id = me;
      delete from public.household_members where household_id = old.id and user_id = me;
    end if;
  end loop;

  insert into public.household_members (household_id, user_id, role) values (new_hid, me, 'adult');
  return new_hid;
end;
$$;

revoke execute on function public.switch_household(text, boolean) from anon;
