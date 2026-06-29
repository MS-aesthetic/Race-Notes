-- ============================================================================
-- Migration 009: Car Profiles
-- ============================================================================

-- 1. cars table
CREATE TABLE public.cars (
  id          text PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  team_id     uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  car_type    text DEFAULT '',
  chassis     text DEFAULT '',
  division    text DEFAULT '',
  name        text DEFAULT '',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

-- Owner manages own cars
CREATE POLICY "Users manage own cars"
  ON public.cars FOR ALL
  USING ((auth.uid())::uuid = user_id);

-- Teammates can view cars owned by anyone in the same team
CREATE POLICY "Team can view cars"
  ON public.cars FOR SELECT
  USING (in_same_team((auth.uid())::uuid, user_id));

-- Teammates can update cars owned by anyone in the same team
CREATE POLICY "Team can update cars"
  ON public.cars FOR UPDATE
  USING (in_same_team((auth.uid())::uuid, user_id));

CREATE INDEX IF NOT EXISTS idx_cars_user_id ON public.cars(user_id);
CREATE INDEX IF NOT EXISTS idx_cars_team_id ON public.cars(team_id);

-- 2. Add car_id to the three scoped tables
--    Plain text (no FK) to match client-generated text PKs and avoid backfill ordering issues.
ALTER TABLE public.setups         ADD COLUMN IF NOT EXISTS car_id text;
ALTER TABLE public.tire_inventory ADD COLUMN IF NOT EXISTS car_id text;

CREATE INDEX IF NOT EXISTS idx_setups_car_id        ON public.setups(car_id);
CREATE INDEX IF NOT EXISTS idx_tire_inventory_car_id ON public.tire_inventory(car_id);

-- 3. shock_sessions table (Decision 1: smasher cloud sync)
CREATE TABLE public.shock_sessions (
  id          text PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  car_id      text,
  label       text DEFAULT '',
  corner      text DEFAULT '',
  spring_rate text DEFAULT '',
  shock       text DEFAULT '',
  date        text DEFAULT '',
  points      jsonb DEFAULT '[]',
  photos      text[] DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
ALTER TABLE public.shock_sessions ENABLE ROW LEVEL SECURITY;

-- Owner manages own shock sessions
CREATE POLICY "Users manage own shock sessions"
  ON public.shock_sessions FOR ALL
  USING ((auth.uid())::uuid = user_id);

-- Teammates can view shock sessions
CREATE POLICY "Team can view shock sessions"
  ON public.shock_sessions FOR SELECT
  USING (in_same_team((auth.uid())::uuid, user_id));

-- Teammates can update shock sessions
CREATE POLICY "Team can update shock sessions"
  ON public.shock_sessions FOR UPDATE
  USING (in_same_team((auth.uid())::uuid, user_id));

CREATE INDEX IF NOT EXISTS idx_shock_sessions_user_id ON public.shock_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_shock_sessions_car_id  ON public.shock_sessions(car_id);
