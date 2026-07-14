alter table if exists public.maintenance_components
  add column if not exists starting_usage integer not null default 0;
