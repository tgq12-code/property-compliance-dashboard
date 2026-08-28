create or replace function public.current_user_is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.approved from public.profiles p where p.id = auth.uid()), false);
$$;

revoke all on function public.current_user_is_approved() from public;
grant execute on function public.current_user_is_approved() to authenticated;

drop policy if exists "users_manage_own_properties" on public.properties;
create policy "approved_users_manage_own_properties" on public.properties
for all using (auth.uid() = user_id and public.current_user_is_approved())
with check (auth.uid() = user_id and public.current_user_is_approved());

drop policy if exists "users_manage_own_businesses" on public.businesses;
create policy "approved_users_manage_own_businesses" on public.businesses
for all using (auth.uid() = user_id and public.current_user_is_approved())
with check (auth.uid() = user_id and public.current_user_is_approved());

drop policy if exists "users_manage_own_obligations" on public.obligations;
create policy "approved_users_manage_own_obligations" on public.obligations
for all using (auth.uid() = user_id and public.current_user_is_approved())
with check (auth.uid() = user_id and public.current_user_is_approved());

drop policy if exists "users_manage_own_payments" on public.payments;
create policy "approved_users_manage_own_payments" on public.payments
for all using (auth.uid() = user_id and public.current_user_is_approved())
with check (auth.uid() = user_id and public.current_user_is_approved());

drop policy if exists "users_manage_own_reminders" on public.reminder_preferences;
create policy "approved_users_manage_own_reminder_preferences" on public.reminder_preferences
for all using (auth.uid() = user_id and public.current_user_is_approved())
with check (auth.uid() = user_id and public.current_user_is_approved());

drop policy if exists "Users can view own family reminders" on public.family_reminders;
drop policy if exists "Users can insert own family reminders" on public.family_reminders;
drop policy if exists "Users can update own family reminders" on public.family_reminders;
drop policy if exists "Users can delete own family reminders" on public.family_reminders;

create policy "approved_users_view_own_family_reminders" on public.family_reminders
for select using (auth.uid() = user_id and public.current_user_is_approved());
create policy "approved_users_insert_own_family_reminders" on public.family_reminders
for insert with check (auth.uid() = user_id and public.current_user_is_approved());
create policy "approved_users_update_own_family_reminders" on public.family_reminders
for update using (auth.uid() = user_id and public.current_user_is_approved())
with check (auth.uid() = user_id and public.current_user_is_approved());
create policy "approved_users_delete_own_family_reminders" on public.family_reminders
for delete using (auth.uid() = user_id and public.current_user_is_approved());
