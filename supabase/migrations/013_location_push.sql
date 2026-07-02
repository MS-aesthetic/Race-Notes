-- ============================================================================
-- Migration 013: Location Sharing + Push Notifications + Saved Trips
-- (plan-v2.md WS-N) — DRAFT, apply with owner approval only.
-- ============================================================================

-- 1. push_tokens — owner-only RLS; the send-push Edge Function reads tokens
--    with the service-role key (bypasses RLS by design).
CREATE TABLE IF NOT EXISTS public.push_tokens (
  token      text PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform   text NOT NULL DEFAULT 'web',   -- 'android' | 'web'
  device_id  text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push tokens" ON public.push_tokens;
CREATE POLICY "Users manage own push tokens"
  ON public.push_tokens FOR ALL
  USING ((auth.uid())::uuid = user_id);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);

-- 2. notifications — in-app notification feed (FCM delivery handled by the
--    send-push Edge Function, which also inserts these rows).
CREATE TABLE IF NOT EXISTS public.notifications (
  id             text PRIMARY KEY,
  to_user        uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  from_user      uuid,
  from_user_name text DEFAULT '',
  team_id        uuid,
  type           text NOT NULL DEFAULT 'ping',  -- 'ping'|'come_here'|'system'
  title          text DEFAULT '',
  body           text DEFAULT '',
  data           jsonb DEFAULT '{}',            -- e.g. { lat, lng, label }
  read_at        timestamptz,
  created_at     timestamptz DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Recipient reads + updates (mark read) own notifications
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT
  USING ((auth.uid())::uuid = to_user);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING ((auth.uid())::uuid = to_user);

-- Teammates may insert notifications addressed to same-team members
DROP POLICY IF EXISTS "Team can insert notifications" ON public.notifications;
CREATE POLICY "Team can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (in_same_team((auth.uid())::uuid, to_user));

CREATE INDEX IF NOT EXISTS idx_notifications_to_user ON public.notifications(to_user);

-- 3. team_locations — ephemeral live positions (Realtime; TTL via expires_at).
--    NOT part of the local-first sync loop.
CREATE TABLE IF NOT EXISTS public.team_locations (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name  text DEFAULT '',
  team_id    uuid NOT NULL,
  lat        double precision NOT NULL,
  lng        double precision NOT NULL,
  heading    double precision,
  speed_mph  double precision,
  label      text DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.team_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own location" ON public.team_locations;
CREATE POLICY "Users manage own location"
  ON public.team_locations FOR ALL
  USING ((auth.uid())::uuid = user_id);

-- Teammates see only fresh (non-expired) locations
DROP POLICY IF EXISTS "Team can view fresh locations" ON public.team_locations;
CREATE POLICY "Team can view fresh locations"
  ON public.team_locations FOR SELECT
  USING (in_same_team((auth.uid())::uuid, user_id) AND expires_at > now());

-- 4. saved_trips — planned truck routes (cached HERE results)
CREATE TABLE IF NOT EXISTS public.saved_trips (
  id           text PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  weekend_id   text,
  weekend_name text DEFAULT '',
  origin       jsonb DEFAULT '{}',
  destination  jsonb DEFAULT '{}',
  polyline     jsonb,                -- [lat,lng][] decoded
  distance_m   integer,
  duration_s   integer,
  notices      jsonb DEFAULT '[]',
  stops        jsonb DEFAULT '[]',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
ALTER TABLE public.saved_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own trips" ON public.saved_trips;
CREATE POLICY "Users manage own trips"
  ON public.saved_trips FOR ALL
  USING ((auth.uid())::uuid = user_id);

DROP POLICY IF EXISTS "Team can view trips" ON public.saved_trips;
CREATE POLICY "Team can view trips"
  ON public.saved_trips FOR SELECT
  USING (in_same_team((auth.uid())::uuid, user_id));

CREATE INDEX IF NOT EXISTS idx_saved_trips_user_id    ON public.saved_trips(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_trips_weekend_id ON public.saved_trips(weekend_id);

-- 5. Realtime publications (live map + in-app notification feed)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_locations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
