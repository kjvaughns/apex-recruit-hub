-- ============ Presenters ============
ALTER TABLE public.presenters
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS presenters_admin_write ON public.presenters;
CREATE POLICY presenters_manage ON public.presenters FOR ALL TO authenticated
  USING (public.academy_can_manage(auth.uid())) WITH CHECK (public.academy_can_manage(auth.uid()));
DROP POLICY IF EXISTS presenters_select_auth ON public.presenters;
CREATE POLICY presenters_select_auth ON public.presenters FOR SELECT TO authenticated
  USING (is_active OR public.academy_can_manage(auth.uid()));

-- ============ Recordings ============
ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS presenter_role text,
  ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_new boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS file_path text;

UPDATE public.recordings SET format = CASE WHEN audio THEN 'audio' ELSE 'video' END;
UPDATE public.recordings SET status = CASE WHEN is_published THEN 'published' ELSE 'draft' END;

ALTER TABLE public.recordings
  ADD CONSTRAINT recordings_format_check CHECK (format IN ('video','audio')),
  ADD CONSTRAINT recordings_status_check CHECK (status IN ('draft','published'));

CREATE OR REPLACE FUNCTION public.recordings_set_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE base text; cand text; n int := 1;
BEGIN
  IF new.slug IS NULL OR new.slug = '' THEN
    base := coalesce(nullif(public.academy_slugify(new.title), ''), 'recording');
    cand := base;
    WHILE EXISTS (SELECT 1 FROM public.recordings WHERE slug = cand AND id <> new.id) LOOP
      n := n + 1; cand := base || '-' || n;
    END LOOP;
    new.slug := cand;
  END IF;
  new.is_published := (new.status = 'published');
  new.audio := (new.format = 'audio');
  new.updated_at := now();
  RETURN new;
END $$;

DROP TRIGGER IF EXISTS recordings_slug_trg ON public.recordings;
CREATE TRIGGER recordings_slug_trg BEFORE INSERT OR UPDATE ON public.recordings
  FOR EACH ROW EXECUTE FUNCTION public.recordings_set_slug();

UPDATE public.recordings SET slug = NULL WHERE slug IS NULL;
UPDATE public.recordings SET title = title WHERE slug IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS recordings_slug_key ON public.recordings(slug);

DROP POLICY IF EXISTS recordings_admin_write ON public.recordings;
CREATE POLICY recordings_manage ON public.recordings FOR ALL TO authenticated
  USING (public.academy_can_manage(auth.uid())) WITH CHECK (public.academy_can_manage(auth.uid()));
DROP POLICY IF EXISTS recordings_select_auth ON public.recordings;
CREATE POLICY recordings_select_auth ON public.recordings FOR SELECT TO authenticated
  USING (status = 'published' OR public.academy_can_manage(auth.uid()));

-- ============ Library ============
ALTER TABLE public.library_resources
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_new boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS duration text,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.library_resources DROP CONSTRAINT IF EXISTS library_resources_type_check;
ALTER TABLE public.library_resources
  ADD CONSTRAINT library_resources_type_check CHECK (type IN (
    'pdf','document','guide','playbook','script','worksheet','link','video','audio','image','other','file'
  )),
  ADD CONSTRAINT library_resources_status_check CHECK (status IN ('draft','published'));

DROP POLICY IF EXISTS library_read ON public.library_resources;
CREATE POLICY library_read ON public.library_resources FOR SELECT TO authenticated
  USING (status = 'published' OR public.academy_can_manage(auth.uid()));

-- ============ Courses / lessons / quizzes ============
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS outcomes text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.course_lessons DROP CONSTRAINT IF EXISTS course_lessons_kind_check;
ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS resource_url text,
  ADD COLUMN IF NOT EXISTS resource_path text,
  ADD COLUMN IF NOT EXISTS resource_label text,
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

UPDATE public.course_lessons SET kind = coalesce(media_type, 'video') WHERE kind = 'lesson';
ALTER TABLE public.course_lessons
  ADD CONSTRAINT course_lessons_kind_check CHECK (kind IN ('video','audio','text','resource','link','quiz','lesson'));

ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS explanation text;

-- ============ Transcripts + AI training notes ============
CREATE TABLE IF NOT EXISTS public.media_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('recording','library','lesson')),
  owner_id uuid NOT NULL,
  source_url text,
  resolved_url text,
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','queued','processing','completed','failed')),
  provider_job_id text,
  transcript_text text,
  transcript_segments jsonb,
  error text,
  notes jsonb,
  notes_status text NOT NULL DEFAULT 'not_started'
    CHECK (notes_status IN ('not_started','processing','completed','failed')),
  notes_error text,
  requested_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_type, owner_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_transcripts TO authenticated;
GRANT ALL ON public.media_transcripts TO service_role;
ALTER TABLE public.media_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY media_transcripts_read ON public.media_transcripts FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY media_transcripts_manage ON public.media_transcripts FOR ALL TO authenticated
  USING (public.academy_can_manage(auth.uid())) WITH CHECK (public.academy_can_manage(auth.uid()));

CREATE TRIGGER media_transcripts_touch BEFORE UPDATE ON public.media_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER library_resources_touch BEFORE UPDATE ON public.library_resources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Security: system settings are staff-only ============
DROP POLICY IF EXISTS "staff reads settings" ON public.system_settings;
CREATE POLICY "staff reads settings" ON public.system_settings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));