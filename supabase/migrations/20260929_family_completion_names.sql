-- Family members may see one another's profile labels for completion history.
create policy "family_members_view_completion_names" on public.profiles
for select to authenticated using (
  public.current_user_is_approved()
  and (
    id = (select public.family_workspace_owner_id())
    or exists (
      select 1 from public.family_workspace_members m
      where m.member_id = profiles.id
        and m.owner_id = (select public.family_workspace_owner_id())
    )
  )
);
