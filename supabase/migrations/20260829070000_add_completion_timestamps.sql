alter table public.properties
  add column if not exists completed_at timestamptz;

alter table public.businesses
  add column if not exists completed_at timestamptz;

alter table public.obligations
  add column if not exists completed_at timestamptz;

alter table public.family_reminders
  add column if not exists completed_at timestamptz;

update public.obligations
set completed_at = coalesce(completed_at, updated_at, now())
where completed_at is null
  and lower(coalesce(status, '')) in ('completed', 'paid');

alter table public.reminder_preferences
  alter column reminder_days set default array[30,7,1];

update public.reminder_preferences
set reminder_days = array[30,7,1],
    updated_at = now();

drop function if exists public.claim_due_obligation_reminders(text, integer);

create function public.claim_due_obligation_reminders(p_secret text, p_limit integer default 100)
returns table (
  log_id uuid,
  obligation_id uuid,
  title text,
  category text,
  amount_due numeric,
  due_date date,
  reminder_day integer,
  official_payment_url text,
  recipient_emails text[],
  property_name text,
  business_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_hash text;
begin
  select cron_secret_hash into expected_hash from private_family_reminder_config where id = true;
  if expected_hash is null or encode(digest(coalesce(p_secret, ''), 'sha256'), 'hex') <> expected_hash then
    raise exception 'unauthorized';
  end if;

  insert into public.obligation_reminder_log (obligation_id, user_id, due_date, reminder_day)
  select o.id, o.user_id, o.due_date, rd.day
  from public.obligations o
  left join public.reminder_preferences rp on rp.user_id = o.user_id
  left join public.properties p on p.id = o.property_id
  cross join lateral unnest(coalesce(rp.reminder_days, array[30,7,1])) as rd(day)
  where coalesce(rp.email_enabled, true) = true
    and o.completed_at is null
    and lower(coalesce(o.status, 'upcoming')) not in ('completed','paid','cancelled','canceled')
    and (o.property_id is null or lower(coalesce(o.category,'')) <> 'property_tax' or coalesce(p.escrowed,false) = false)
    and current_date = o.due_date - rd.day
  on conflict (obligation_id, due_date, reminder_day) do nothing;

  return query
  with due as (
    select l.id
    from public.obligation_reminder_log l
    join public.obligations o on o.id = l.obligation_id
    join auth.users u on u.id = l.user_id
    where l.status in ('pending','failed')
      and (l.processing_started_at is null or l.processing_started_at < now() - interval '20 minutes')
      and u.email is not null
      and o.completed_at is null
      and lower(coalesce(o.status, 'upcoming')) not in ('completed','paid','cancelled','canceled')
    order by o.due_date asc, l.reminder_day desc
    limit greatest(1, least(coalesce(p_limit, 100), 250))
    for update of l skip locked
  ), claimed as (
    update public.obligation_reminder_log l
    set status = 'processing', processing_started_at = now(), last_error = null, updated_at = now()
    from due
    where l.id = due.id
    returning l.*
  )
  select c.id, o.id, o.title, o.category, o.amount_due, o.due_date, c.reminder_day,
         o.official_payment_url,
         array_remove(array_cat(array[u.email::text], coalesce(rp.compliance_recipient_emails, '{}'::text[])), null),
         p.name, b.name
  from claimed c
  join public.obligations o on o.id = c.obligation_id
  join auth.users u on u.id = c.user_id
  left join public.reminder_preferences rp on rp.user_id = o.user_id
  left join public.properties p on p.id = o.property_id
  left join public.businesses b on b.id = o.business_id
  order by o.due_date asc, c.reminder_day desc;
end;
$$;

revoke all on function public.claim_due_obligation_reminders(text, integer) from public;
grant execute on function public.claim_due_obligation_reminders(text, integer) to anon, authenticated;
