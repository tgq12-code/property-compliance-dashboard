alter table public.properties
  add column if not exists property_tax_year text,
  add column if not exists property_tax_source text,
  add column if not exists property_tax_status text not null default 'needs_confirmation',
  add column if not exists tax_lookup_checked_at timestamptz;
