-- ============================================================================
-- Migration 010: Feature Batch Foundation (WS-A)
-- ============================================================================
-- Adds new columns to support:
--   WS-C  Tire Lifecycle (date_added, initial_age_days, usage_dates, heat_cycles)
--   WS-E  Weather History / Forecast (weather_history, weather_forecast)
--   WS-F  Task↔Weekend association (weekend_id, weekend_name)
--
-- All columns are additive with safe defaults — existing data is preserved.
-- ============================================================================

-- 1. tire_inventory — lifecycle tracking columns
ALTER TABLE public.tire_inventory
  ADD COLUMN IF NOT EXISTS date_added       timestamptz,
  ADD COLUMN IF NOT EXISTS initial_age_days int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_dates      jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS heat_cycles      int DEFAULT 0;

-- 2. race_weekends — weather history & forecast strips
ALTER TABLE public.race_weekends
  ADD COLUMN IF NOT EXISTS weather_history   jsonb,
  ADD COLUMN IF NOT EXISTS weather_forecast  jsonb;

-- 3. todos — list-level weekend association
--    (TodoItem already has per-item weekendId/weekendName in the jsonb `items` array;
--     this adds the same at the list level per WS-F)
ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS weekend_id   text,
  ADD COLUMN IF NOT EXISTS weekend_name text;
