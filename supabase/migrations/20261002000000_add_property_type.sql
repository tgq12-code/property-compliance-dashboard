alter table public.properties add column if not exists property_type text;

alter table public.properties add constraint properties_property_type_check
  check (property_type is null or property_type in ('Home', 'Condo', 'Land', 'Other'));
