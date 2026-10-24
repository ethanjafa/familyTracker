-- Settings: household owners can remove family members.

-- ---------------------------------------------------------------------------
-- Removing family members
-- ---------------------------------------------------------------------------

-- Removes someone from the household and clears them from every assignment, so their
-- avatar doesn't linger on routines and steps. Their personal items stay hidden (RLS).
create function public.remove_member(hid uuid, member uuid) returns void
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
end;
$$;

revoke execute on function public.remove_member(uuid, uuid) from anon;
