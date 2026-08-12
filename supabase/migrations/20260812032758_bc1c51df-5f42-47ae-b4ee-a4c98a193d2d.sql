ALTER TABLE public.media_transcripts
  ADD COLUMN IF NOT EXISTS speaker_names jsonb NOT NULL DEFAULT '{}'::jsonb;

DROP POLICY IF EXISTS "staff read profiles" ON public.profiles;
CREATE POLICY "read own and downline profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.can_access_user(auth.uid(), id));