-- WS-Z: team members who can update shared maintenance/templates must also be
-- able to delete them. Additive policies; no row changes.

DROP POLICY IF EXISTS "Team can delete maintenance components" ON public.maintenance_components;
CREATE POLICY "Team can delete maintenance components"
  ON public.maintenance_components FOR DELETE
  USING (in_same_team((auth.uid())::uuid, user_id));

DROP POLICY IF EXISTS "Team can delete maintenance logs" ON public.maintenance_logs;
CREATE POLICY "Team can delete maintenance logs"
  ON public.maintenance_logs FOR DELETE
  USING (in_same_team((auth.uid())::uuid, user_id));

DROP POLICY IF EXISTS "Team can delete checklist templates" ON public.checklist_templates;
CREATE POLICY "Team can delete checklist templates"
  ON public.checklist_templates FOR DELETE
  USING (in_same_team((auth.uid())::uuid, user_id));
