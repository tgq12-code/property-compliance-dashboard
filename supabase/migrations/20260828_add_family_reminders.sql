create table if not exists public.family_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text not null,
  notes text,
  starts_at timestamptz not null,
  timezone text not null default 'America/Los_Angeles',
  recurrence text not null default 'none' check (recurrence in ('none','daily','weekly','monthly','yearly')),
  recipient_emails text[] not null default '{}',
  sender_email text not null default 'tuan.pi@gmail.com',
  active boolean not null default true,
  last_sent_at timestamptz,
  next_send_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.family_reminders enable row level security;

create policy "Users can view own family reminders"
on public.family_reminders for select
using (auth.uid() = user_id);

create policy "Users can insert own family reminders"
on public.family_reminders for insert
with check (auth.uid() = user_id);

create policy "Users can update own family reminders"
on public.family_reminders for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own family reminders"
on public.family_reminders for delete
using (auth.uid() = user_id);

create index if not exists family_reminders_user_id_idx on public.family_reminders(user_id);
create index if not exists family_reminders_next_send_at_idx on public.family_reminders(next_send_at) where active = true;
