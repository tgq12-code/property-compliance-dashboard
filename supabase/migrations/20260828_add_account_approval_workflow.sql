alter table public.profiles
  add column if not exists approved boolean not null default false,
  add column if not exists is_admin boolean not null default false,
  add column if not exists approval_requested_at timestamptz not null default now(),
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null;

insert into public.profiles (id, email, approved, is_admin, approved_at)
select id, email, true, true, now()
from auth.users
where lower(email) = 'tuan.pi@gmail.com'
on conflict (id) do update
set email = excluded.email,
    approved = true,
    is_admin = true,
    approved_at = coalesce(public.profiles.approved_at, now());

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, approved, is_admin, approval_requested_at, approved_at)
  values (
    new.id,
    new.email,
    lower(coalesce(new.email,'')) = 'tuan.pi@gmail.com',
    lower(coalesce(new.email,'')) = 'tuan.pi@gmail.com',
    now(),
    case when lower(coalesce(new.email,'')) = 'tuan.pi@gmail.com' then now() else null end
  )
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert or update of email on auth.users
for each row execute function public.handle_new_user_profile();

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;

drop policy if exists "users_manage_own_profile" on public.profiles;
drop policy if exists "users_read_own_profile" on public.profiles;
drop policy if exists "admins_read_all_profiles" on public.profiles;
drop policy if exists "admins_update_all_profiles" on public.profiles;

create policy "users_read_own_profile" on public.profiles
for select using (auth.uid() = id);

create policy "admins_read_all_profiles" on public.profiles
for select using (public.current_user_is_admin());

create policy "admins_update_all_profiles" on public.profiles
for update using (public.current_user_is_admin()) with check (public.current_user_is_admin());
