-- Account deletion (required by the App Store and Google Play): delete_my_account() removes the
-- signed-in person and everything that is only theirs. Shared family things they created are
-- handed to another member first, so the rest of the family keeps them.

create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  hh record;
  heir uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;

  for hh in select household_id, role from public.household_members where user_id = me loop
    -- The longest-standing other member takes over (null when you're the only one).
    select user_id into heir from public.household_members
    where household_id = hh.household_id and user_id <> me
    order by (role = 'owner') desc, joined_at
    limit 1;

    if heir is null then
      -- Last member: the household and all of its data go.
      delete from public.households where id = hh.household_id;
    else
      if hh.role = 'owner' then
        update public.household_members set role = 'owner' where household_id = hh.household_id and user_id = heir;
      end if;
      update public.households set created_by = heir where id = hh.household_id and created_by = me;
      -- Shared categories and to-do lists you created stay with the family.
      update public.routine_categories set owner_id = heir
      where household_id = hh.household_id and owner_id = me and visibility = 'family';
      update public.projects set owner_id = heir
      where household_id = hh.household_id and owner_id = me and visibility = 'family';
      update public.invites set created_by = heir where household_id = hh.household_id and created_by = me;
      -- Your check-ins on shared routines stay in the family's history.
      update public.routine_logs l set user_id = heir
      from public.routines r
      join public.routine_categories c on c.id = r.category_id
      where l.routine_id = r.id and l.user_id = me and l.household_id = hh.household_id
        and r.private_to is null and c.visibility = 'family';
      -- You're taken off shared routines; everything else clears itself (owners, cooks → nobody).
      update public.routines
      set assignee_ids = array_remove(assignee_ids, me),
          day_assignees = coalesce(
            (select jsonb_object_agg(key, value) from jsonb_each_text(day_assignees) where value <> me::text),
            '{}'::jsonb
          )
      where household_id = hh.household_id
        and (me = any(assignee_ids) or day_assignees::text like '%' || me::text || '%');
    end if;
  end loop;

  delete from public.invites where created_by = me;
  -- Removing the login removes the profile, and with it your personal items, check-ins and memberships.
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from anon;
