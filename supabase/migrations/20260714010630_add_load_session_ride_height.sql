-- UX-C6A: optional ride-height note for existing load sessions.
-- Additive and backward-compatible. Apply before deploying client mapper.
ALTER TABLE IF EXISTS public.shock_sessions
  ADD COLUMN IF NOT EXISTS ride_height_ctoc text DEFAULT '';
