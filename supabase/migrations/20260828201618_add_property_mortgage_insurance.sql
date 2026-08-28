alter table public.properties
  add column if not exists mortgage_servicer text,
  add column if not exists mortgage_balance numeric(14,2),
  add column if not exists mortgage_monthly_payment numeric(12,2),
  add column if not exists mortgage_interest_rate numeric(7,4),
  add column if not exists mortgage_statement_date date,
  add column if not exists mortgage_payment_due_date date,
  add column if not exists insurance_carrier text,
  add column if not exists insurance_annual_premium numeric(12,2),
  add column if not exists insurance_policy_start_date date,
  add column if not exists insurance_policy_expiration_date date;

comment on column public.properties.mortgage_balance is
  'Remaining principal shown on the latest mortgage statement; not a payoff quote.';

comment on column public.properties.mortgage_monthly_payment is
  'Regular monthly payment shown on the latest mortgage statement.';

comment on column public.properties.insurance_annual_premium is
  'Total annual policy premium, including taxes and fees when the policy lists them together.';
