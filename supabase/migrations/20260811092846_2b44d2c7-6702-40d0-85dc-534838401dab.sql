-- Portal Redesign — Phase 3: expanded settings.
--
--  * notification_prefs stores the agent's per-event notification toggles.
--    Durable + cross-device; enforcement in send triggers comes later once the
--    real event list is finalized.
--  * avatars bucket backs profile-photo upload. Signed-in read; each user may
--    only write within their own <uid>/ folder.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb;

COMMENT ON COLUMN public.profiles.notification_prefs IS
  'Per-event notification toggles for this agent (jsonb map of event key -> bool).';

-- ---- Avatars storage policies --------------------------------------------
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
DROP POLICY IF EXISTS "avatars authenticated read" ON storage.objects;
CREATE POLICY "avatars authenticated read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars owner insert" ON storage.objects;
CREATE POLICY "avatars owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars owner update" ON storage.objects;
CREATE POLICY "avatars owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars owner delete" ON storage.objects;
CREATE POLICY "avatars owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);