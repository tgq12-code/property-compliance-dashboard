alter table public.businesses
  add column if not exists ein text,
  add column if not exists tax_year_type text not null default 'calendar',
  add column if not exists ca_annual_tax_applies boolean not null default false,
  add column if not exists ca_additional_llc_fee_status text not null default 'unknown';

alter table public.businesses
  drop constraint if exists businesses_tax_year_type_check;

alter table public.businesses
  add constraint businesses_tax_year_type_check
  check (tax_year_type in ('calendar', 'fiscal'));

alter table public.businesses
  drop constraint if exists businesses_ca_additional_llc_fee_status_check;

alter table public.businesses
  add constraint businesses_ca_additional_llc_fee_status_check
  check (ca_additional_llc_fee_status in ('yes', 'no', 'unknown'));

comment on column public.businesses.ca_annual_tax_applies is
  'Whether the California $800 minimum annual LLC tax should be tracked for this entity.';

comment on column public.businesses.ca_additional_llc_fee_status is
  'Whether the California income-based additional LLC fee may apply; tracked separately from the $800 annual tax.';
