-- UX Chunk 6B: additive setup-version and race-weekend lifecycle fields.
-- No foreign keys: local-first records can be uploaded in either order.

alter table if exists public.setups
  add column if not exists notes text default '',
  add column if not exists screenshots jsonb default '[]'::jsonb,
  add column if not exists toe text default '',
  add column if not exists jbar text default '',
  add column if not exists jbar_frame_height text default '',
  add column if not exists jbar_pinion_height text default '',
  add column if not exists version_label text default '',
  add column if not exists lifecycle_role text,
  add column if not exists source_setup_id text,
  add column if not exists weekend_id text,
  add column if not exists locked_at timestamptz,
  add column if not exists change_log jsonb default '[]'::jsonb;

alter table if exists public.race_weekends
  add column if not exists notes text default '',
  add column if not exists weather jsonb,
  add column if not exists location text default '',
  add column if not exists setup_id text,
  add column if not exists setup_name text default '',
  add column if not exists weather_history jsonb,
  add column if not exists weather_forecast jsonb,
  add column if not exists status text default 'active',
  add column if not exists finished_at timestamptz,
  add column if not exists source_setup_id text,
  add column if not exists baseline_setup_id text,
  add column if not exists active_setup_id text,
  add column if not exists final_setup_id text;
