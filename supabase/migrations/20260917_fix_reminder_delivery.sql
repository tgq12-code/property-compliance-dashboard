-- Qualify the private config key because claim_due_family_reminders also
-- exposes an output column named id.
create or replace function public.claim_due_family_reminders(p_secret text, p_limit integer default 25)
returns table(id uuid, title text, subject text, notes text, starts_at timestamptz, timezone text, recurrence text, recipient_emails text[], sender_email text, next_send_at timestamptz)
language plpgsql security definer set search_path to 'public'
as $function$
declare expected_hash text;
begin
  select cfg.cron_secret_hash into expected_hash
  from public.private_family_reminder_config cfg
  where cfg.id = true;
  if expected_hash is null or encode(digest(coalesce(p_secret, ''), 'sha256'), 'hex') <> expected_hash then
    raise exception 'unauthorized';
  end if;
  return query
  with due as (
    select fr.id from public.family_reminders fr
    where fr.active = true and fr.next_send_at is not null and fr.next_send_at <= now()
      and cardinality(fr.recipient_emails) > 0
      and (fr.processing_started_at is null or fr.processing_started_at < now() - interval '20 minutes')
    order by fr.next_send_at asc
    limit greatest(1, least(coalesce(p_limit, 25), 100))
    for update skip locked
  ), claimed as (
    update public.family_reminders fr
    set processing_started_at = now(), last_error = null, updated_at = now()
    from due where fr.id = due.id returning fr.*
  )
  select c.id, c.title, c.subject, c.notes, c.starts_at, c.timezone, c.recurrence,
         c.recipient_emails, c.sender_email, c.next_send_at
  from claimed c order by c.next_send_at asc;
end;
$function$;

create or replace function public.claim_due_obligation_reminders(p_secret text, p_limit integer default 100)
returns table(log_id uuid, obligation_id uuid, title text, category text, amount_due numeric, due_date date, reminder_day integer, official_payment_url text, recipient_emails text[], property_name text, business_name text)
language plpgsql security definer set search_path to 'public'
as $function$
declare expected_hash text;
begin
  select cfg.cron_secret_hash into expected_hash
  from public.private_family_reminder_config cfg
  where cfg.id = true;
  if expected_hash is null or encode(digest(coalesce(p_secret, ''), 'sha256'), 'hex') <> expected_hash then
    raise exception 'unauthorized';
  end if;
  insert into public.obligation_reminder_log (obligation_id, user_id, due_date, reminder_day)
  select o.id, o.user_id, o.due_date, rd.day
  from public.obligations o
  left join public.reminder_preferences rp on rp.user_id = o.user_id
  left join public.properties p on p.id = o.property_id
  cross join lateral unnest(coalesce(rp.reminder_days, array[30,7,1])) as rd(day)
  where coalesce(rp.email_enabled, true) = true and o.completed_at is null
    and lower(coalesce(o.status, 'upcoming')) not in ('completed','paid','cancelled','canceled')
    and (o.property_id is null or lower(coalesce(o.category,'')) <> 'property_tax' or coalesce(p.escrowed,false) = false)
    and current_date = o.due_date - rd.day
  on conflict (obligation_id, due_date, reminder_day) do nothing;
  return query
  with due as (
    select l.id from public.obligation_reminder_log l
    join public.obligations o on o.id = l.obligation_id
    join auth.users u on u.id = l.user_id
    where l.status in ('pending','failed')
      and (l.processing_started_at is null or l.processing_started_at < now() - interval '20 minutes')
      and u.email is not null and o.completed_at is null
      and lower(coalesce(o.status, 'upcoming')) not in ('completed','paid','cancelled','canceled')
    order by o.due_date asc, l.reminder_day desc
    limit greatest(1, least(coalesce(p_limit, 100), 250))
    for update of l skip locked
  ), claimed as (
    update public.obligation_reminder_log l
    set status = 'processing', processing_started_at = now(), last_error = null, updated_at = now()
    from due where l.id = due.id returning l.*
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
$function$;
