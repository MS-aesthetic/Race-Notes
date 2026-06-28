-- ============================================================================
-- Migration 005: Fix Infinite Recursion in Team Members RLS
-- ============================================================================

-- 1. Helper functions must be SECURITY DEFINER to bypass RLS and avoid infinite recursion
CREATE OR REPLACE FUNCTION public.is_team_member(target_team_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = target_team_id AND user_id = (auth.uid())::uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_team_owner(target_team_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = target_team_id AND user_id = (auth.uid())::uuid AND role = 'owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.in_same_team(user_a uuid, user_b uuid)
RETURNS boolean AS $$
BEGIN
  IF user_a = user_b THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.team_members tm1
    JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = user_a AND tm2.user_id = user_b
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing broken policies on team_members
DROP POLICY IF EXISTS "Users can view their team memberships" ON public.team_members;
DROP POLICY IF EXISTS "Owners can add members" ON public.team_members;
DROP POLICY IF EXISTS "Users and Owners can add members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can invite/remove members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.team_members;
DROP POLICY IF EXISTS "Team members SELECT" ON public.team_members;
DROP POLICY IF EXISTS "Team members INSERT" ON public.team_members;
DROP POLICY IF EXISTS "Team members DELETE" ON public.team_members;

-- 3. Replace with safe ones
CREATE POLICY "Team members SELECT"
  ON public.team_members FOR SELECT
  USING (
    user_id = (auth.uid())::uuid
    OR 
    public.is_team_member(team_id)
  );

CREATE POLICY "Team members INSERT"
  ON public.team_members FOR INSERT
  WITH CHECK (
    user_id = (auth.uid())::uuid 
    OR 
    public.is_team_owner(team_id)
  );

CREATE POLICY "Team members DELETE"
  ON public.team_members FOR DELETE
  USING (
    user_id = (auth.uid())::uuid 
    OR 
    public.is_team_owner(team_id)
  );
