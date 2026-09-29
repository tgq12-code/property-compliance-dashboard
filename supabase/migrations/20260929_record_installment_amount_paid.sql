alter table public.property_tax_installments
  add column amount_paid numeric(12,2) check (amount_paid >= 0);

-- Keep the installment, its payment amount, and any linked reminder item in one transaction.
create function public.set_property_tax_installment_payment(
  p_property_id uuid,
  p_tax_cycle text,
  p_installment_number smallint,
  p_due_date date,
  p_complete boolean,
  p_obligation_id uuid,
  p_amount_paid numeric
)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_complete and (p_amount_paid is null or p_amount_paid < 0) then
    raise exception 'Enter the amount paid';
  end if;

  perform public.set_property_tax_installment_status(
    p_property_id, p_tax_cycle, p_installment_number, p_due_date, p_complete, p_obligation_id
  );
  update public.property_tax_installments
  set amount_paid = case when p_complete then round(p_amount_paid, 2) else null end
  where property_id = p_property_id and tax_cycle = p_tax_cycle
    and installment_number = p_installment_number
    and user_id = public.family_workspace_owner_id();
end;
$$;
revoke all on function public.set_property_tax_installment_payment(uuid,text,smallint,date,boolean,uuid,numeric) from public;
grant execute on function public.set_property_tax_installment_payment(uuid,text,smallint,date,boolean,uuid,numeric) to authenticated;
