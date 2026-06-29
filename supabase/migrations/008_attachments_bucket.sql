-- ============================================================================
-- Migration 008: Race Attachments Storage Bucket
-- Stores photos/files for sessions and setups in Supabase Storage.
-- Path convention: race-attachments/{userId}/{sessions|setups}/{entityId}/{filename}
-- Files are publicly readable via URL, but upload/delete requires auth.
-- Team sync is automatic — teammates pull the public URLs via synced JSON rows.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'race-attachments',
  'race-attachments',
  true,
  10485760,  -- 10 MB per file
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ── SELECT: authenticated users can list/read ──────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read attachments" ON storage.objects;
CREATE POLICY "Authenticated users can read attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'race-attachments' AND auth.role() = 'authenticated');

-- ── INSERT: users upload only under their own {userId}/ prefix ─────────────
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'race-attachments'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── UPDATE ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update own attachments" ON storage.objects;
CREATE POLICY "Users can update own attachments"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'race-attachments'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── DELETE ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can delete own attachments" ON storage.objects;
CREATE POLICY "Users can delete own attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'race-attachments'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

