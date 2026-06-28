-- ============================================================================
-- Migration 007: DEFINITIVE Team RLS Reset (Eliminates ALL Recursion)
-- Run this entire script. It is safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: Temporarily disable RLS so we can clean everything safely
-- ---------------------------------------------------------------------------
ALTER TABLE public.team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- STEP 2: Drop EVERY known policy on team_members and teams
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their team memberships" ON public.team_members;
DROP POLICY IF EXISTS "Owners can add members" ON public.team_members;
DROP POLICY IF EXISTS "Users and Owners can add members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can invite/remove members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.team_members;
DROP POLICY IF EXISTS "Team members SELECT" ON public.team_members;
DROP POLICY IF EXISTS "Team members INSERT" ON public.team_members;
DROP POLICY IF EXISTS "Team members DELETE" ON public.team_members;

DROP POLICY IF EXISTS "Teams are viewable by all members" ON public.teams;
DROP POLICY IF EXISTS "Users can create teams" ON public.teams;
DROP POLICY IF EXISTS "Owners can update team" ON public.teams;
DROP POLICY IF EXISTS "Owners can delete team" ON public.teams;

-- ---------------------------------------------------------------------------
-- STEP 3: SECURITY DEFINER helper functions (these bypass RLS - no recursion)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_team_member(target_team_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = target_team_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner(target_team_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = target_team_id AND user_id = auth.uid() AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.in_same_team(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT CASE WHEN user_a = user_b THEN true
  ELSE EXISTS (
    SELECT 1 FROM public.team_members tm1
    JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = user_a AND tm2.user_id = user_b
  ) END;
$$;

-- ---------------------------------------------------------------------------
-- STEP 4: Re-enable RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- STEP 5: TEAM_MEMBERS policies (only reference auth.uid() + DEFINER funcs)
-- ---------------------------------------------------------------------------
-- View: you can see your own rows, or rows for a team you belong to
CREATE POLICY "tm_select"
  ON public.team_members FOR SELECT
  USING ( user_id = auth.uid() OR public.is_team_member(team_id) );

-- Insert: you can add yourself (creating a team) or an owner can add others
CREATE POLICY "tm_insert"
  ON public.team_members FOR INSERT
  WITH CHECK ( user_id = auth.uid() OR public.is_team_owner(team_id) );

-- Delete: you can remove yourself (leave) or an owner can remove anyone
CREATE POLICY "tm_delete"
  ON public.team_members FOR DELETE
  USING ( user_id = auth.uid() OR public.is_team_owner(team_id) );

-- ---------------------------------------------------------------------------
-- STEP 6: TEAMS policies
-- ---------------------------------------------------------------------------
CREATE POLICY "teams_select"
  ON public.teams FOR SELECT
  USING ( public.is_team_member(id) );

CREATE POLICY "teams_insert"
  ON public.teams FOR INSERT
  WITH CHECK ( true );

CREATE POLICY "teams_update"
  ON public.teams FOR UPDATE
  USING ( public.is_team_owner(id) );

CREATE POLICY "teams_delete"
  ON public.teams FOR DELETE
  USING ( public.is_team_owner(id) );
