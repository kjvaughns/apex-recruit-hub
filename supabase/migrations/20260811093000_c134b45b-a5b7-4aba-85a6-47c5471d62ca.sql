-- Vantage Academy — Phase 1: data model.
--
-- Courses (modules → lessons/quizzes → questions), per-agent enrollment +
-- current-attempt-only lesson progress, and a tagged library. Deep links are
-- built on unique auto-generated slugs. RLS: agents see published content +
-- their own progress; admins/leaders with can_manage_resources edit everything.

/* ---------------- helpers ---------------- */

CREATE OR REPLACE FUNCTION public.academy_slugify(_txt text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(_txt, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- Admins, or leaders/managers granted can_manage_resources, may edit Academy.
CREATE OR REPLACE FUNCTION public.academy_can_manage(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.is_admin(_uid), false)
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = _uid AND coalesce(p.can_manage_resources, false)
      );
$$;

/* ---------------- courses ---------------- */

CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  title text NOT NULL,
  description text,
  long_description text,
  instructor_name text,
  instructor_role text,
  is_required boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  position int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS course_modules_course_idx ON public.course_modules (course_id, position);

CREATE TABLE IF NOT EXISTS public.course_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'lesson' CHECK (kind IN ('lesson','quiz')),
  position int NOT NULL DEFAULT 0,
  media_type text CHECK (media_type IN ('video','audio')),
  video_url text,
  duration text,
  blurb text,
  quiz_pass_threshold numeric NOT NULL DEFAULT 0.75
);
CREATE INDEX IF NOT EXISTS course_lessons_module_idx ON public.course_lessons (module_id, position);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  options text[] NOT NULL DEFAULT '{}',
  correct_index int NOT NULL DEFAULT 0,
  position int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS quiz_questions_lesson_idx ON public.quiz_questions (lesson_id, position);

/* ---------------- enrollment + progress ---------------- */

CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  final_score numeric,
  UNIQUE (course_id, user_id)
);
CREATE INDEX IF NOT EXISTS enrollments_user_idx ON public.enrollments (user_id);

-- Current-attempt-only: one row per (enrollment, lesson); retakes overwrite.
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  completed_at timestamptz,
  quiz_score numeric,
  UNIQUE (enrollment_id, lesson_id)
);

/* ---------------- library ---------------- */

CREATE TABLE IF NOT EXISTS public.library_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  title text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('file','video','audio','link')),
  url text,
  is_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.library_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.library_resource_tags (
  resource_id uuid NOT NULL REFERENCES public.library_resources(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.library_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, tag_id)
);

/* ---------------- slug auto-generation ---------------- */

CREATE OR REPLACE FUNCTION public.courses_set_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE base text; cand text; n int := 1;
BEGIN
  IF new.slug IS NULL OR new.slug = '' THEN
    base := nullif(public.academy_slugify(new.title), '');
    base := coalesce(base, 'course');
    cand := base;
    WHILE EXISTS (SELECT 1 FROM public.courses WHERE slug = cand AND id <> new.id) LOOP
      n := n + 1; cand := base || '-' || n;
    END LOOP;
    new.slug := cand;
  END IF;
  new.updated_at := now();
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS courses_slug_trg ON public.courses;
CREATE TRIGGER courses_slug_trg BEFORE INSERT OR UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.courses_set_slug();

CREATE OR REPLACE FUNCTION public.library_set_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE base text; cand text; n int := 1;
BEGIN
  IF new.slug IS NULL OR new.slug = '' THEN
    base := nullif(public.academy_slugify(new.title), '');
    base := coalesce(base, 'resource');
    cand := base;
    WHILE EXISTS (SELECT 1 FROM public.library_resources WHERE slug = cand AND id <> new.id) LOOP
      n := n + 1; cand := base || '-' || n;
    END LOOP;
    new.slug := cand;
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS library_slug_trg ON public.library_resources;
CREATE TRIGGER library_slug_trg BEFORE INSERT OR UPDATE ON public.library_resources
  FOR EACH ROW EXECUTE FUNCTION public.library_set_slug();

/* ---------------- grants + RLS ---------------- */

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'courses','course_modules','course_lessons','quiz_questions',
    'enrollments','lesson_progress','library_resources','library_tags','library_resource_tags'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Courses: read published or managers; write managers.
DROP POLICY IF EXISTS courses_read ON public.courses;
CREATE POLICY courses_read ON public.courses FOR SELECT TO authenticated
  USING (status = 'published' OR public.academy_can_manage(auth.uid()));
DROP POLICY IF EXISTS courses_write ON public.courses;
CREATE POLICY courses_write ON public.courses FOR ALL TO authenticated
  USING (public.academy_can_manage(auth.uid())) WITH CHECK (public.academy_can_manage(auth.uid()));

-- Modules/lessons/questions: readable if their course is readable; write managers.
DROP POLICY IF EXISTS modules_read ON public.course_modules;
CREATE POLICY modules_read ON public.course_modules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (c.status = 'published' OR public.academy_can_manage(auth.uid()))));
DROP POLICY IF EXISTS modules_write ON public.course_modules;
CREATE POLICY modules_write ON public.course_modules FOR ALL TO authenticated
  USING (public.academy_can_manage(auth.uid())) WITH CHECK (public.academy_can_manage(auth.uid()));

DROP POLICY IF EXISTS lessons_read ON public.course_lessons;
CREATE POLICY lessons_read ON public.course_lessons FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.course_modules m JOIN public.courses c ON c.id = m.course_id
                 WHERE m.id = module_id
                 AND (c.status = 'published' OR public.academy_can_manage(auth.uid()))));
DROP POLICY IF EXISTS lessons_write ON public.course_lessons;
CREATE POLICY lessons_write ON public.course_lessons FOR ALL TO authenticated
  USING (public.academy_can_manage(auth.uid())) WITH CHECK (public.academy_can_manage(auth.uid()));

DROP POLICY IF EXISTS questions_read ON public.quiz_questions;
CREATE POLICY questions_read ON public.quiz_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.course_lessons l JOIN public.course_modules m ON m.id = l.module_id
                 JOIN public.courses c ON c.id = m.course_id
                 WHERE l.id = lesson_id
                 AND (c.status = 'published' OR public.academy_can_manage(auth.uid()))));
DROP POLICY IF EXISTS questions_write ON public.quiz_questions;
CREATE POLICY questions_write ON public.quiz_questions FOR ALL TO authenticated
  USING (public.academy_can_manage(auth.uid())) WITH CHECK (public.academy_can_manage(auth.uid()));

-- Enrollments/progress: own rows (managers may read all).
DROP POLICY IF EXISTS enrollments_read ON public.enrollments;
CREATE POLICY enrollments_read ON public.enrollments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.academy_can_manage(auth.uid()));
DROP POLICY IF EXISTS enrollments_write ON public.enrollments;
CREATE POLICY enrollments_write ON public.enrollments FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS progress_read ON public.lesson_progress;
CREATE POLICY progress_read ON public.lesson_progress FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_id
                 AND (e.user_id = auth.uid() OR public.academy_can_manage(auth.uid()))));
DROP POLICY IF EXISTS progress_write ON public.lesson_progress;
CREATE POLICY progress_write ON public.lesson_progress FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_id AND e.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_id AND e.user_id = auth.uid()));

-- Library: read published or managers; write managers. Tags readable by all.
DROP POLICY IF EXISTS library_read ON public.library_resources;
CREATE POLICY library_read ON public.library_resources FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS library_write ON public.library_resources;
CREATE POLICY library_write ON public.library_resources FOR ALL TO authenticated
  USING (public.academy_can_manage(auth.uid())) WITH CHECK (public.academy_can_manage(auth.uid()));

DROP POLICY IF EXISTS tags_read ON public.library_tags;
CREATE POLICY tags_read ON public.library_tags FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS tags_write ON public.library_tags;
CREATE POLICY tags_write ON public.library_tags FOR ALL TO authenticated
  USING (public.academy_can_manage(auth.uid())) WITH CHECK (public.academy_can_manage(auth.uid()));

DROP POLICY IF EXISTS resource_tags_read ON public.library_resource_tags;
CREATE POLICY resource_tags_read ON public.library_resource_tags FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS resource_tags_write ON public.library_resource_tags;
CREATE POLICY resource_tags_write ON public.library_resource_tags FOR ALL TO authenticated
  USING (public.academy_can_manage(auth.uid())) WITH CHECK (public.academy_can_manage(auth.uid()));

/* ---------------- storage policies (bucket created separately) ---------------- */

DROP POLICY IF EXISTS "academy public read" ON storage.objects;
DROP POLICY IF EXISTS "academy authenticated read" ON storage.objects;
CREATE POLICY "academy authenticated read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'academy');
DROP POLICY IF EXISTS "academy manage write" ON storage.objects;
CREATE POLICY "academy manage write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'academy' AND public.academy_can_manage(auth.uid()));
DROP POLICY IF EXISTS "academy manage update" ON storage.objects;
CREATE POLICY "academy manage update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'academy' AND public.academy_can_manage(auth.uid()));
DROP POLICY IF EXISTS "academy manage delete" ON storage.objects;
CREATE POLICY "academy manage delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'academy' AND public.academy_can_manage(auth.uid()));

/* ---------------- migrate existing content into the library ---------------- */
-- One-time: only when the library is empty, so re-running is a no-op.

DO $$
DECLARE r record; new_id uuid; tag text; tid uuid; v_type text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.library_resources) THEN RETURN; END IF;

  -- Existing "resources" rows.
  FOR r IN SELECT * FROM public.resources LOOP
    v_type := CASE
      WHEN r.type = 'video' THEN 'video'
      WHEN r.type = 'pdf' THEN 'file'
      ELSE 'link'
    END;
    INSERT INTO public.library_resources (title, description, type, url, is_required)
    VALUES (r.title, r.description, v_type, r.url, false)
    RETURNING id INTO new_id;

    IF r.category IS NOT NULL AND r.category <> '' THEN
      INSERT INTO public.library_tags (name) VALUES (initcap(r.category))
        ON CONFLICT (name) DO NOTHING;
      SELECT id INTO tid FROM public.library_tags WHERE name = initcap(r.category);
      INSERT INTO public.library_resource_tags (resource_id, tag_id) VALUES (new_id, tid)
        ON CONFLICT DO NOTHING;
    END IF;

    IF r.tags IS NOT NULL THEN
      FOREACH tag IN ARRAY r.tags LOOP
        IF tag IS NOT NULL AND trim(tag) <> '' THEN
          INSERT INTO public.library_tags (name) VALUES (initcap(trim(tag)))
            ON CONFLICT (name) DO NOTHING;
          SELECT id INTO tid FROM public.library_tags WHERE name = initcap(trim(tag));
          INSERT INTO public.library_resource_tags (resource_id, tag_id) VALUES (new_id, tid)
            ON CONFLICT DO NOTHING;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  -- Published "recordings" become audio/video library items, tagged accordingly.
  INSERT INTO public.library_tags (name) VALUES ('Recorded Training') ON CONFLICT (name) DO NOTHING;
  SELECT id INTO tid FROM public.library_tags WHERE name = 'Recorded Training';
  FOR r IN SELECT * FROM public.recordings WHERE is_published = true LOOP
    INSERT INTO public.library_resources (title, description, type, url, is_required)
    VALUES (r.title, r.description, CASE WHEN coalesce(r.audio, false) THEN 'audio' ELSE 'video' END, r.video_url, false)
    RETURNING id INTO new_id;
    INSERT INTO public.library_resource_tags (resource_id, tag_id) VALUES (new_id, tid)
      ON CONFLICT DO NOTHING;
  END LOOP;
END $$;