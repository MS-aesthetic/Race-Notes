-- ============================================================================
-- Migration 003: Teams & To-Do Lists
-- ============================================================================

-- 1. Teams Table
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- 2. Team Members
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text CHECK (role IN ('owner', 'member')) DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Now add policies
CREATE POLICY "Users can create teams"
  ON public.teams FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Teams are viewable by all members"
  ON public.teams FOR SELECT
  USING ((auth.uid())::uuid IN (SELECT user_id FROM public.team_members WHERE team_id = public.teams.id));

CREATE POLICY "Users can view their team memberships"
  ON public.team_members FOR SELECT
  USING ((auth.uid())::uuid = user_id OR (auth.uid())::uuid IN (
    SELECT user_id FROM public.team_members WHERE team_id = public.team_members.team_id
  ));

CREATE POLICY "Users and Owners can add members"
  ON public.team_members FOR INSERT
  WITH CHECK (
    (auth.uid())::uuid = user_id 
    OR 
    (auth.uid())::uuid IN (
      SELECT tm.user_id FROM public.team_members tm 
      WHERE tm.team_id = team_members.team_id AND tm.role = 'owner'
    )
  );

-- 3. Todos
CREATE TABLE public.todos (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  items jsonb DEFAULT '[]',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- 4. Helper Function: in_same_team()
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
$$ LANGUAGE plpgsql STABLE;

-- 5. RLS for Syncing automatically within teams
CREATE POLICY "Team can view/edit todos" ON public.todos FOR ALL USING (in_same_team((auth.uid())::uuid, user_id));
CREATE POLICY "Team can view setups" ON public.setups FOR SELECT USING (in_same_team((auth.uid())::uuid, user_id));
CREATE POLICY "Team can update setups" ON public.setups FOR UPDATE USING (in_same_team((auth.uid())::uuid, user_id));
CREATE POLICY "Team can view weekends" ON public.race_weekends FOR SELECT USING (in_same_team((auth.uid())::uuid, user_id));
CREATE POLICY "Team can update weekends" ON public.race_weekends FOR UPDATE USING (in_same_team((auth.uid())::uuid, user_id));
CREATE POLICY "Team can view sessions" ON public.active_sessions FOR SELECT USING (in_same_team((auth.uid())::uuid, user_id));
CREATE POLICY "Team can update sessions" ON public.active_sessions FOR UPDATE USING (in_same_team((auth.uid())::uuid, user_id));