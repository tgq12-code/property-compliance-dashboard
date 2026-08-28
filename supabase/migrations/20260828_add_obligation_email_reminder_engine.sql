create table if not exists public.obligation_reminder_log (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references public.obligations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  due_date date not null,
  reminder_day integer not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  processing_started_at timestamptz,
  sent_at timestamptz,
  send_failures integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (obligation_id, due_date, reminder_day)
);

alter table public.obligation_reminder_log enable row level security;

create policy "users_view_own_obligation_reminder_log" on public.obligation_reminder_log
for select using (auth.uid() = user_id);

insert into public.reminder_preferences (user_id, email_enabled, reminder_days)
select u.id, true, array[60,30,14,7,2,0,-1,-7]
from auth.users u
where not exists (select 1 from public.reminder_preferences rp where rp.user_id = u.id);

update public.reminder_preferences
set reminder_days = (
  select array_agg(distinct d order by d desc)
  from unnest(reminder_days || array[60,30,14,7,2,0,-1,-7]) d
), updated_at = now();

create or replace function public.claim_due_obligation_reminders(p_secret text, p_limit integer default 100)
returns table (
  log_id uuid,
  obligation_id uuid,
  title text,
  category text,
  amount_due numeric,
  due_date date,
  reminder_day integer,
  official_payment_url text,
  recipient_email text,
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
  cross join lateral unnest(coalesce(rp.reminder_days, array[60,30,14,7,2,0,-1,-7])) as rd(day)
  where coalesce(rp.email_enabled, true) = true
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
         o.official_payment_url, u.email::text, p.name, b.name
  from claimed c
  join public.obligations o on o.id = c.obligation_id
  join auth.users u on u.id = c.user_id
  left join public.properties p on p.id = o.property_id
  left join public.businesses b on b.id = o.business_id
  order by o.due_date asc, c.reminder_day desc;
end;
$$;

create or replace function public.complete_obligation_reminder_send(p_secret text, p_log_id uuid, p_sent_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare expected_hash text;
begin
  select cron_secret_hash into expected_hash from private_family_reminder_config where id = true;
  if expected_hash is null or encode(digest(coalesce(p_secret, ''), 'sha256'), 'hex') <> expected_hash then raise exception 'unauthorized'; end if;
  update public.obligation_reminder_log
  set status = 'sent', sent_at = p_sent_at, processing_started_at = null, last_error = null, updated_at = now()
  where id = p_log_id;
end;
$$;

create or replace function public.fail_obligation_reminder_send(p_secret text, p_log_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare expected_hash text;
begin
  select cron_secret_hash into expected_hash from private_family_reminder_config where id = true;
  if expected_hash is null or encode(digest(coalesce(p_secret, ''), 'sha256'), 'hex') <> expected_hash then raise exception 'unauthorized'; end if;
  update public.obligation_reminder_log
  set status = 'failed', processing_started_at = null, send_failures = send_failures + 1,
      last_error = left(coalesce(p_error,'Unknown send error'),1000), updated_at = now()
  where id = p_log_id;
end;
$$;

grant execute on function public.claim_due_obligation_reminders(text, integer) to anon, authenticated;
grant execute on function public.complete_obligation_reminder_send(text, uuid, timestamptz) to anon, authenticated;
grant execute on function public.fail_obligation_reminder_send(text, uuid, text) to anon, authenticated;
