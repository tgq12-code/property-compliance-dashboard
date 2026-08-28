create extension if not exists pgcrypto;

alter table public.family_reminders
  add column if not exists processing_started_at timestamptz,
  add column if not exists send_failures integer not null default 0,
  add column if not exists last_error text;

create table if not exists private_family_reminder_config (
  id boolean primary key default true check (id),
  cron_secret_hash text not null,
  updated_at timestamptz not null default now()
);

revoke all on private_family_reminder_config from public, anon, authenticated;

-- The production secret hash is injected directly in Supabase and intentionally omitted from source control.

create or replace function public.claim_due_family_reminders(p_secret text, p_limit integer default 25)
returns table (
  id uuid,
  title text,
  subject text,
  notes text,
  starts_at timestamptz,
  timezone text,
  recurrence text,
  recipient_emails text[],
  sender_email text,
  next_send_at timestamptz
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

  return query
  with due as (
    select fr.id
    from public.family_reminders fr
    where fr.active = true
      and fr.next_send_at is not null
      and fr.next_send_at <= now()
      and cardinality(fr.recipient_emails) > 0
      and (fr.processing_started_at is null or fr.processing_started_at < now() - interval '20 minutes')
    order by fr.next_send_at asc
    limit greatest(1, least(coalesce(p_limit, 25), 100))
    for update skip locked
  ), claimed as (
    update public.family_reminders fr
    set processing_started_at = now(), last_error = null, updated_at = now()
    from due
    where fr.id = due.id
    returning fr.*
  )
  select c.id, c.title, c.subject, c.notes, c.starts_at, c.timezone, c.recurrence,
         c.recipient_emails, c.sender_email, c.next_send_at
  from claimed c
  order by c.next_send_at asc;
end;
$$;

create or replace function public.complete_family_reminder_send(
  p_secret text,
  p_id uuid,
  p_sent_at timestamptz,
  p_next_send_at timestamptz,
  p_keep_active boolean
)
returns void
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

  update public.family_reminders
  set last_sent_at = p_sent_at,
      next_send_at = p_next_send_at,
      active = p_keep_active,
      processing_started_at = null,
      last_error = null,
      updated_at = now()
  where id = p_id;
end;
$$;

create or replace function public.fail_family_reminder_send(
  p_secret text,
  p_id uuid,
  p_error text
)
returns void
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

  update public.family_reminders
  set processing_started_at = null,
      send_failures = send_failures + 1,
      last_error = left(coalesce(p_error, 'Unknown send error'), 1000),
      updated_at = now()
  where id = p_id;
end;
$$;

grant execute on function public.claim_due_family_reminders(text, integer) to anon, authenticated;
grant execute on function public.complete_family_reminder_send(text, uuid, timestamptz, timestamptz, boolean) to anon, authenticated;
grant execute on function public.fail_family_reminder_send(text, uuid, text) to anon, authenticated;
