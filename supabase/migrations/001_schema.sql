-- ============================================================================
-- Race Notes – Supabase Database Schema
-- Run this in the Supabase SQL Editor (supabase.com → SQL Editor → New Query)
-- ============================================================================

-- Clean up any partially-created tables from prior failed runs
DROP TABLE IF EXISTS public.shared_setups CASCADE;
DROP TABLE IF EXISTS public.active_sessions CASCADE;
DROP TABLE IF EXISTS public.race_weekends CASCADE;
DROP TABLE IF EXISTS public.setups CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- ---------------------------------------------------------------------------
-- 1. Profiles (public user metadata)
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK ((auth.uid())::uuid = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING ((auth.uid())::uuid = id);

-- Auto-create profile on signup
CREATE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Setups (car chassis configurations)
-- ---------------------------------------------------------------------------
CREATE TABLE public.setups (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  chassis text DEFAULT '',
  track text DEFAULT '',
  date text DEFAULT '',
  car_type text DEFAULT '',
  gear text DEFAULT '',
  front_stagger text DEFAULT '',
  rear_stagger text DEFAULT '',
  pull_bar_frame_hole text DEFAULT '',
  pull_bar_rear_hole text DEFAULT '',
  pull_bar_angle text DEFAULT '',
  lf jsonb DEFAULT '{}',
  rf jsonb DEFAULT '{}',
  lr jsonb DEFAULT '{}',
  rr jsonb DEFAULT '{}',
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.setups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own setups"
  ON public.setups FOR ALL
  USING ((auth.uid())::uuid = user_id);

-- (Shared-view policy added below, after shared_setups table is created)

-- ---------------------------------------------------------------------------
-- 3. Race Weekends
-- ---------------------------------------------------------------------------
CREATE TABLE public.race_weekends (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text DEFAULT '',
  track text DEFAULT '',
  date text DEFAULT '',
  sessions jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.race_weekends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own weekends"
  ON public.race_weekends FOR ALL
  USING ((auth.uid())::uuid = user_id);

-- ---------------------------------------------------------------------------
-- 4. Active Sessions (live session state)
-- ---------------------------------------------------------------------------
CREATE TABLE public.active_sessions (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  data jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own active session"
  ON public.active_sessions FOR ALL
  USING ((auth.uid())::uuid = user_id);

-- ---------------------------------------------------------------------------
-- 5. Shared Setups (many-to-many sharing with permissions)
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_setups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setup_id text REFERENCES public.setups(id) ON DELETE CASCADE NOT NULL,
  shared_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shared_with uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission text CHECK (permission IN ('view', 'clone')) DEFAULT 'view',
  created_at timestamptz DEFAULT now(),
  UNIQUE(setup_id, shared_with)
);

ALTER TABLE public.shared_setups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can share their own setups"
  ON public.shared_setups FOR INSERT
  WITH CHECK ((auth.uid())::uuid = shared_by);

CREATE POLICY "Users can view shares they're involved in"
  ON public.shared_setups FOR SELECT
  USING ((auth.uid())::uuid = shared_by OR (auth.uid())::uuid = shared_with);

CREATE POLICY "Users can delete shares they created"
  ON public.shared_setups FOR DELETE
  USING ((auth.uid())::uuid = shared_by);

-- ---------------------------------------------------------------------------
-- Add deferred policy: shared users can view setups
-- (Must run after shared_setups table exists)
-- ---------------------------------------------------------------------------
CREATE POLICY "Shared users can view setups"
  ON public.setups FOR SELECT
  USING (
    (auth.uid())::uuid IN (
      SELECT shared_with FROM public.shared_setups WHERE setup_id = public.setups.id
    )
    OR is_public = true
  );

-- ---------------------------------------------------------------------------
-- Indexes for performance
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_setups_user_id ON public.setups(user_id);
CREATE INDEX IF NOT EXISTS idx_setups_updated_at ON public.setups(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_weekends_user_id ON public.race_weekends(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_setups_setup_id ON public.shared_setups(setup_id);
CREATE INDEX IF NOT EXISTS idx_shared_setups_shared_with ON public.shared_setups(shared_with);

-- Enable trigram extension for profile search (required for GIN index)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles USING gin (display_name gin_trgm_ops);
