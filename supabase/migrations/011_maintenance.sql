-- ============================================================================
-- Migration 011: Maintenance / ERP (plan-v2.md WS-N) — DRAFT, apply with
-- owner approval only. Additive; idempotent.
-- ============================================================================

-- 1. maintenance_components
CREATE TABLE IF NOT EXISTS public.maintenance_components (
  id             text PRIMARY KEY,
  user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  scope          text NOT NULL DEFAULT 'car',          -- 'car' | 'rig'
  car_id         text,                                 -- required when scope='car'
  name           text DEFAULT '',
  category       text DEFAULT 'Other',
  interval_type  text NOT NULL DEFAULT 'races',        -- 'laps'|'sessions'|'races'|'days'
  interval_value integer NOT NULL DEFAULT 1,
  last_serviced_at timestamptz DEFAULT now(),
  manual_units   integer,
  notes          text DEFAULT '',
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
ALTER TABLE public.maintenance_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own maintenance components" ON public.maintenance_components;
CREATE POLICY "Users manage own maintenance components"
  ON public.maintenance_components FOR ALL
  USING ((auth.uid())::uuid = user_id);

DROP POLICY IF EXISTS "Team can view maintenance components" ON public.maintenance_components;
CREATE POLICY "Team can view maintenance components"
  ON public.maintenance_components FOR SELECT
  USING (in_same_team((auth.uid())::uuid, user_id));

DROP POLICY IF EXISTS "Team can update maintenance components" ON public.maintenance_components;
CREATE POLICY "Team can update maintenance components"
  ON public.maintenance_components FOR UPDATE
  USING (in_same_team((auth.uid())::uuid, user_id));

CREATE INDEX IF NOT EXISTS idx_maintenance_components_user_id ON public.maintenance_components(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_components_car_id  ON public.maintenance_components(car_id);

-- 2. maintenance_logs (service history; one row per service/replace/inspect)
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id                  text PRIMARY KEY,
  user_id             uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  component_id        text NOT NULL,
  date                text DEFAULT '',
  type                text NOT NULL DEFAULT 'service', -- 'service'|'replace'|'inspect'
  notes               text DEFAULT '',
  cost                numeric,
  accounting_entry_id text,
  used_at_service     integer,
  done_by             uuid,
  done_by_name        text DEFAULT '',
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own maintenance logs" ON public.maintenance_logs;
CREATE POLICY "Users manage own maintenance logs"
  ON public.maintenance_logs FOR ALL
  USING ((auth.uid())::uuid = user_id);

DROP POLICY IF EXISTS "Team can view maintenance logs" ON public.maintenance_logs;
CREATE POLICY "Team can view maintenance logs"
  ON public.maintenance_logs FOR SELECT
  USING (in_same_team((auth.uid())::uuid, user_id));

DROP POLICY IF EXISTS "Team can update maintenance logs" ON public.maintenance_logs;
CREATE POLICY "Team can update maintenance logs"
  ON public.maintenance_logs FOR UPDATE
  USING (in_same_team((auth.uid())::uuid, user_id));

CREATE INDEX IF NOT EXISTS idx_maintenance_logs_user_id      ON public.maintenance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_component_id ON public.maintenance_logs(component_id);
