-- ============================================================================
-- Migration 012: Pre-race Checklists (plan-v2.md WS-N) — DRAFT, apply with
-- owner approval only. Additive; idempotent.
-- ============================================================================

-- 1. checklist_templates (reusable; items jsonb like todos.items)
CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id         text PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       text DEFAULT '',
  category   text DEFAULT 'Custom',
  items      jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own checklist templates" ON public.checklist_templates;
CREATE POLICY "Users manage own checklist templates"
  ON public.checklist_templates FOR ALL
  USING ((auth.uid())::uuid = user_id);

DROP POLICY IF EXISTS "Team can view checklist templates" ON public.checklist_templates;
CREATE POLICY "Team can view checklist templates"
  ON public.checklist_templates FOR SELECT
  USING (in_same_team((auth.uid())::uuid, user_id));

DROP POLICY IF EXISTS "Team can update checklist templates" ON public.checklist_templates;
CREATE POLICY "Team can update checklist templates"
  ON public.checklist_templates FOR UPDATE
  USING (in_same_team((auth.uid())::uuid, user_id));

CREATE INDEX IF NOT EXISTS idx_checklist_templates_user_id ON public.checklist_templates(user_id);

-- 2. weekend_checklists (per-weekend instance; snapshot of a template)
CREATE TABLE IF NOT EXISTS public.weekend_checklists (
  id           text PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  weekend_id   text,                 -- nulled when weekend deleted (association only)
  weekend_name text DEFAULT '',
  template_id  text,
  name         text DEFAULT '',
  category     text DEFAULT 'Custom',
  items        jsonb DEFAULT '[]',   -- ChecklistItemState[] incl. done/doneBy/doneAt
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
ALTER TABLE public.weekend_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own weekend checklists" ON public.weekend_checklists;
CREATE POLICY "Users manage own weekend checklists"
  ON public.weekend_checklists FOR ALL
  USING ((auth.uid())::uuid = user_id);

DROP POLICY IF EXISTS "Team can view weekend checklists" ON public.weekend_checklists;
CREATE POLICY "Team can view weekend checklists"
  ON public.weekend_checklists FOR SELECT
  USING (in_same_team((auth.uid())::uuid, user_id));

DROP POLICY IF EXISTS "Team can update weekend checklists" ON public.weekend_checklists;
CREATE POLICY "Team can update weekend checklists"
  ON public.weekend_checklists FOR UPDATE
  USING (in_same_team((auth.uid())::uuid, user_id));

CREATE INDEX IF NOT EXISTS idx_weekend_checklists_user_id   ON public.weekend_checklists(user_id);
CREATE INDEX IF NOT EXISTS idx_weekend_checklists_weekend_id ON public.weekend_checklists(weekend_id);
