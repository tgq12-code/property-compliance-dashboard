create or replace function public.is_family_completion_profile(profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_is_approved() and (
    profile_id = public.family_workspace_owner_id()
    or exists (
      select 1 from public.family_workspace_members m
      where m.member_id = profile_id and m.owner_id = public.family_workspace_owner_id()
    )
  );
$$;
revoke all on function public.is_family_completion_profile(uuid) from public;
grant execute on function public.is_family_completion_profile(uuid) to authenticated;
drop policy if exists "family_members_view_completion_names" on public.profiles;
create policy "family_members_view_completion_names" on public.profiles
for select to authenticated using (public.is_family_completion_profile(id));
