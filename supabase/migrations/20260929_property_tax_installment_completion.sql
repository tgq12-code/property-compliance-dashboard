create table public.property_tax_installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  tax_cycle text not null,
  installment_number smallint not null check (installment_number between 1 and 2),
  due_date date not null,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (property_id, tax_cycle, installment_number)
);
create index property_tax_installments_user_idx on public.property_tax_installments(user_id);
alter table public.property_tax_installments enable row level security;
grant select, insert, update, delete on public.property_tax_installments to authenticated;
create policy "family_workspace_tax_installments" on public.property_tax_installments
for all to authenticated
using (user_id = (select public.family_workspace_owner_id()))
with check (user_id = (select public.family_workspace_owner_id()));
create trigger record_completion_actor before insert or update on public.property_tax_installments
for each row execute function public.record_completion_actor();

-- A single transaction updates both the installment and its linked reminder item.
create function public.set_property_tax_installment_status(
  p_property_id uuid,
  p_tax_cycle text,
  p_installment_number smallint,
  p_due_date date,
  p_complete boolean,
  p_obligation_id uuid default null
)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_owner uuid;
begin
  v_owner := public.family_workspace_owner_id();
  if v_owner is null or not exists (
    select 1 from public.properties p where p.id = p_property_id and p.user_id = v_owner
  ) then
    raise exception 'Property access denied';
  end if;
  if p_installment_number not between 1 and 2 or p_due_date is null or nullif(trim(p_tax_cycle),'') is null then
    raise exception 'Invalid installment';
  end if;
  if p_obligation_id is not null and not exists (
    select 1 from public.obligations o
    where o.id = p_obligation_id and o.property_id = p_property_id
      and o.user_id = v_owner and lower(o.category) = 'property_tax'
      and o.due_date = p_due_date
  ) then
    raise exception 'Tax deadline does not match this installment';
  end if;

  insert into public.property_tax_installments
    (user_id, property_id, tax_cycle, installment_number, due_date, completed_at)
  values (v_owner, p_property_id, p_tax_cycle, p_installment_number, p_due_date,
    case when p_complete then now() else null end)
  on conflict (property_id, tax_cycle, installment_number) do update
  set due_date = excluded.due_date, completed_at = excluded.completed_at;

  if p_obligation_id is not null then
    update public.obligations
    set status = case when p_complete then 'paid' else 'upcoming' end,
        completed_at = case when p_complete then now() else null end,
        updated_at = now()
    where id = p_obligation_id and property_id = p_property_id and user_id = v_owner;
  end if;
end;
$$;
revoke all on function public.set_property_tax_installment_status(uuid,text,smallint,date,boolean,uuid) from public;
grant execute on function public.set_property_tax_installment_status(uuid,text,smallint,date,boolean,uuid) to authenticated;
