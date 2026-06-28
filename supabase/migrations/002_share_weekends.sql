CREATE TABLE public.shared_weekends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekend_id text REFERENCES public.race_weekends(id) ON DELETE CASCADE NOT NULL,
  shared_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shared_with uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission text CHECK (permission IN ('view', 'clone')) DEFAULT 'view',
  created_at timestamptz DEFAULT now(),
  UNIQUE(weekend_id, shared_with)
);

ALTER TABLE public.shared_weekends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can share their own weekends"
  ON public.shared_weekends FOR INSERT
  WITH CHECK ((auth.uid())::uuid = shared_by);

CREATE POLICY "Users can view weekend shares they're involved in"
  ON public.shared_weekends FOR SELECT
  USING ((auth.uid())::uuid = shared_by OR (auth.uid())::uuid = shared_with);

CREATE POLICY "Users can delete weekend shares they created"
  ON public.shared_weekends FOR DELETE
  USING ((auth.uid())::uuid = shared_by);

-- Make shared weekends viewable by users they are shared with
CREATE POLICY "Shared users can view weekends"
  ON public.race_weekends FOR SELECT
  USING (
    (auth.uid())::uuid IN (
      SELECT shared_with FROM public.shared_weekends WHERE weekend_id = public.race_weekends.id
    )
  );

CREATE INDEX IF NOT EXISTS idx_shared_weekends_weekend_id ON public.shared_weekends(weekend_id);
CREATE INDEX IF NOT EXISTS idx_shared_weekends_shared_with ON public.shared_weekends(shared_with);