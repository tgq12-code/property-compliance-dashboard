-- Let the sole approved administrator securely synchronize the reminder
-- scheduler secret. Only its SHA-256 hash is stored.

create or replace function public.rotate_reminder_cron_secret(p_new_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.approved = true
      and p.is_admin = true
  ) then
    raise exception 'Only an approved administrator can update the reminder scheduler secret'
      using errcode = '42501';
  end if;

  if length(coalesce(p_new_secret, '')) < 32 then
    raise exception 'The scheduler secret must be at least 32 characters'
      using errcode = '22023';
  end if;

  if p_new_secret like 'sk_live_%' or p_new_secret like 'sk_test_%' then
    raise exception 'Do not use a Stripe API key as the scheduler secret'
      using errcode = '22023';
  end if;

  insert into public.private_family_reminder_config (id, cron_secret_hash, updated_at)
  values (true, encode(extensions.digest(p_new_secret, 'sha256'), 'hex'), now())
  on conflict (id) do update
    set cron_secret_hash = excluded.cron_secret_hash,
        updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.rotate_reminder_cron_secret(text) from public;
revoke all on function public.rotate_reminder_cron_secret(text) from anon;
grant execute on function public.rotate_reminder_cron_secret(text) to authenticated;
