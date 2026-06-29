-- Migration 010: Add is_template column to todos table
-- Fixes: templates were missing this column, causing them to lose template status
-- after cloud pull and appear as regular lists (with done:false items) in Dashboard.

ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;
