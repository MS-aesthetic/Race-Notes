-- ============================================================================
-- Migration 004: Team Banners, Todo Templates, and Atomic Team Creation
-- ============================================================================

-- 1. Add Banner URL to Teams
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS banner_url text;

-- 2. Add is_template to Todos
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS is_template boolean DEFAULT false;

-- 3. Fix Team Creation RLS Bug via Security Definer Function
-- (When creating a team, the user isn't in team_members yet, so they fail SELECT policies if returning the row.)
CREATE OR REPLACE FUNCTION public.create_team(team_name text)
RETURNS uuid AS $$
DECLARE
  new_team_id uuid;
BEGIN
  INSERT INTO public.teams (name) VALUES (team_name) RETURNING id INTO new_team_id;
  INSERT INTO public.team_members (team_id, user_id, role) VALUES (new_team_id, auth.uid()::uuid, 'owner');
  RETURN new_team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Storage Bucket for Team Banners
INSERT INTO storage.buckets (id, name, public) VALUES ('team_banners', 'team_banners', true) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Banners are publicly accessible" ON storage.objects;
CREATE POLICY "Banners are publicly accessible" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'team_banners');

DROP POLICY IF EXISTS "Users can upload banners" ON storage.objects;
CREATE POLICY "Users can upload banners" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'team_banners' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update own banners" ON storage.objects;
CREATE POLICY "Users can update own banners" 
  ON storage.objects FOR UPDATE 
  USING (bucket_id = 'team_banners' AND auth.role() = 'authenticated');
