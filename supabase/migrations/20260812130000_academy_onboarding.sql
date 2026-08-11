-- Academy Phase 5: the Vantage Onboarding course lives inside Academy.
--
-- Per product direction, the existing onboarding page + applicants.onboarding_steps
-- model stay authoritative. This adds a parallel *course* representation in
-- Academy (Required, published) at slug 'vantage-onboarding', plus a helper to
-- enroll an agent when they reach the Onboarding stage. The two are
-- cross-linked, not merged — no onboarding_steps migration.

DO $$
DECLARE cid uuid; m1 uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE slug = 'vantage-onboarding') THEN
    INSERT INTO public.courses (slug, title, description, long_description, instructor_name, is_required, status)
    VALUES (
      'vantage-onboarding',
      'Vantage Onboarding',
      'Everything you need to get set up and active as a licensed Vantage agent.',
      'Work through each step to finish onboarding. Your live checklist also lives on the Onboarding page.',
      'Vantage Team',
      true,
      'published'
    )
    RETURNING id INTO cid;

    INSERT INTO public.course_modules (course_id, title, position)
    VALUES (cid, 'Getting set up', 0)
    RETURNING id INTO m1;

    INSERT INTO public.course_lessons (module_id, title, kind, position, media_type, blurb) VALUES
      (m1, 'AgentSpace contracting', 'lesson', 0, 'video', 'Join the agency in AgentSpace using the agency code from your onboarding checklist.'),
      (m1, 'Discord role update',    'lesson', 1, 'video', 'Follow the steps in Discord to get your Licensed Agent role.'),
      (m1, 'Portal account setup',   'lesson', 2, 'video', 'You are logged into the portal — this step is handled automatically.'),
      (m1, 'Expectations review',    'lesson', 3, 'video', 'Review our hours, standing meetings, and team standards.');
  END IF;
END $$;

-- Enroll a specific agent into a published course by slug (idempotent).
-- SECURITY DEFINER so the recruiting flow can enroll an agent (not the caller).
CREATE OR REPLACE FUNCTION public.academy_enroll(_slug text, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid;
BEGIN
  IF _user IS NULL THEN RETURN; END IF;
  SELECT id INTO cid FROM public.courses WHERE slug = _slug AND status = 'published';
  IF cid IS NULL THEN RETURN; END IF;
  INSERT INTO public.enrollments (course_id, user_id) VALUES (cid, _user)
    ON CONFLICT (course_id, user_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.academy_enroll(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.academy_enroll(text, uuid) TO authenticated, service_role;
