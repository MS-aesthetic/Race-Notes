-- ============================================================================
-- Migration 006: Fix Final Recursion Link in Teams Table
-- ============================================================================

-- 1. Create a SECURITY DEFINER function to check team membership safely
CREATE OR REPLACE FUNCTION public.user_can_view_team(target_team_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = target_team_id AND user_id = (auth.uid())::uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Drop the broken recursive policy on teams created in Migration 003
DROP POLICY IF EXISTS "Teams are viewable by all members" ON public.teams;


-- 3. Replace it with the safe, non-recursive function call
CREATE POLICY "Teams are viewable by all members"
  ON public.teams FOR SELECT
  USING (public.user_can_view_team(id));


-- 4. Just to be absolutely safe, let's also fix the in_same_team function
-- used for setups, weekends, active_sessions, and todos.
-- It was already SECURITY DEFINER from Migration 005, but we recreate here 
-- to ensure it fully drops context to SECURITY DEFINER.
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
