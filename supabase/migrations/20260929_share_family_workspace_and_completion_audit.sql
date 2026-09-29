-- Explicit family membership keeps private records limited to invited accounts.
create table if not exists public.family_workspace_members (
  member_id uuid primary key references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint family_member_not_owner check (member_id <> owner_id)
);
create index if not exists family_workspace_members_owner_idx on public.family_workspace_members(owner_id);
alter table public.family_workspace_members enable row level security;
revoke all on public.family_workspace_members from anon, authenticated;

create or replace function public.family_workspace_owner_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select case when public.current_user_is_approved()
    then coalesce((select m.owner_id from public.family_workspace_members m where m.member_id = auth.uid()), auth.uid())
    else null::uuid end;
$$;
revoke all on function public.family_workspace_owner_id() from public;
grant execute on function public.family_workspace_owner_id() to authenticated;

drop policy if exists "approved_users_manage_own_properties" on public.properties;
create policy "family_workspace_properties" on public.properties for all to authenticated
  using (user_id = (select public.family_workspace_owner_id()))
  with check (user_id = (select public.family_workspace_owner_id()));
drop policy if exists "approved_users_manage_own_businesses" on public.businesses;
create policy "family_workspace_businesses" on public.businesses for all to authenticated
  using (user_id = (select public.family_workspace_owner_id()))
  with check (user_id = (select public.family_workspace_owner_id()));
drop policy if exists "approved_users_manage_own_obligations" on public.obligations;
create policy "family_workspace_obligations" on public.obligations for all to authenticated
  using (user_id = (select public.family_workspace_owner_id()))
  with check (user_id = (select public.family_workspace_owner_id()));
drop policy if exists "approved_users_manage_own_payments" on public.payments;
create policy "family_workspace_payments" on public.payments for all to authenticated
  using (user_id = (select public.family_workspace_owner_id()))
  with check (user_id = (select public.family_workspace_owner_id()));
drop policy if exists "approved_users_manage_own_reminder_preferences" on public.reminder_preferences;
create policy "family_workspace_reminder_preferences" on public.reminder_preferences for all to authenticated
  using (user_id = (select public.family_workspace_owner_id()))
  with check (user_id = (select public.family_workspace_owner_id()));
drop policy if exists "approved_users_view_own_family_reminders" on public.family_reminders;
drop policy if exists "approved_users_insert_own_family_reminders" on public.family_reminders;
drop policy if exists "approved_users_update_own_family_reminders" on public.family_reminders;
drop policy if exists "approved_users_delete_own_family_reminders" on public.family_reminders;
create policy "family_workspace_reminders" on public.family_reminders for all to authenticated
  using (user_id = (select public.family_workspace_owner_id()))
  with check (user_id = (select public.family_workspace_owner_id()));
drop policy if exists "users_view_own_obligation_reminder_log" on public.obligation_reminder_log;
create policy "family_workspace_reminder_log" on public.obligation_reminder_log for select to authenticated
  using (user_id = (select public.family_workspace_owner_id()));

alter table public.properties add column if not exists completed_by uuid references auth.users(id) on delete set null;
alter table public.businesses add column if not exists completed_by uuid references auth.users(id) on delete set null;
alter table public.obligations add column if not exists completed_by uuid references auth.users(id) on delete set null;
alter table public.family_reminders add column if not exists completed_by uuid references auth.users(id) on delete set null;

-- The client cannot claim another person's identity or alter a recorded completion time.
create or replace function public.record_completion_actor()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.completed_at is null then
    new.completed_by := null;
  elsif tg_op = 'INSERT' or old.completed_at is null then
    new.completed_at := now();
    new.completed_by := auth.uid();
  else
    new.completed_at := old.completed_at;
    new.completed_by := old.completed_by;
  end if;
  return new;
end;
$$;
do $$
declare target text;
begin
  foreach target in array array['properties','businesses','obligations','family_reminders'] loop
    execute format('drop trigger if exists record_completion_actor on public.%I', target);
    execute format('create trigger record_completion_actor before insert or update on public.%I for each row execute function public.record_completion_actor()', target);
  end loop;
end $$;
