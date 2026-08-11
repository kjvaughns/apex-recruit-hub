-- Phase 2 — Evaluation form → auto-hire.
--
-- After the Overview is completed, a recruiter sends the applicant a pre-filled
-- evaluation link (/evaluation?a=<applicant_id>). On submission we:
--   * match the submission to the existing applicant record (by id, or email),
--   * move them to a "hired — pending" stage: reuse the existing Licensing stage
--     for unlicensed hires and the Contracting stage for licensed hires,
--   * stamp hired_at (idempotent), and
--   * increment a persistent per-recruiter hires counter for the leaderboard.

-- Persistent hire counter for the attributed recruiter.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hires integer NOT NULL DEFAULT 0;

-- Mark when an applicant was auto-hired via the evaluation form.
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS hired_at timestamptz;

COMMENT ON COLUMN public.profiles.hires IS
  'Count of applicants auto-hired via the evaluation form, attributed to this recruiter.';
COMMENT ON COLUMN public.applicants.hired_at IS
  'When the applicant was auto-hired on evaluation submission. NULL until hired.';

-- ---- Prefill context for the evaluation form -----------------------------
-- Safe, minimal projection resolved by unguessable applicant UUID. Mirrors the
-- scheduling-context pattern: no recruiter PII, only what the form prefills.
CREATE OR REPLACE FUNCTION public.get_evaluation_prefill(_applicant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v applicants%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.applicants WHERE id = _applicant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  RETURN jsonb_build_object(
    'found', true,
    'first_name', v.first_name,
    'last_name', v.last_name,
    'email', v.email,
    'licensed', v.licensed,
    'licensing_status', v.licensing_status,
    'already_hired', v.hired_at IS NOT NULL
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_evaluation_prefill(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_evaluation_prefill(uuid) TO anon, authenticated, service_role;

-- ---- Evaluation submission with auto-hire ---------------------------------
CREATE OR REPLACE FUNCTION public.submit_evaluation(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_applicant_id uuid := nullif(payload->>'applicant_id','')::uuid;
  v_email text := lower(trim(coalesce(payload->>'email','')));
  v_answers jsonb := coalesce(payload->'answers', '{}'::jsonb);
  v_eval_id uuid;
  v_app applicants%ROWTYPE;
  v_target_slug text;
  v_stage_id uuid;
  v_recruiter uuid;
  v_hired boolean := false;
BEGIN
  IF v_applicant_id IS NULL AND v_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  -- Resolve the applicant: prefer the embedded id, fall back to newest email match.
  IF v_applicant_id IS NOT NULL THEN
    SELECT * INTO v_app FROM public.applicants WHERE id = v_applicant_id;
  ELSE
    SELECT * INTO v_app FROM public.applicants
      WHERE lower(email) = v_email
      ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_email = '' AND v_app.id IS NOT NULL THEN
    v_email := lower(v_app.email);
  END IF;

  INSERT INTO public.evaluations (email, answers, applicant_id, matched)
  VALUES (v_email, v_answers, v_app.id, v_app.id IS NOT NULL)
  RETURNING id INTO v_eval_id;

  IF v_app.id IS NOT NULL THEN
    -- Reuse existing pipeline stages: licensed hires -> Contracting,
    -- unlicensed hires -> Licensing (the "hired — pending" states).
    v_target_slug := CASE WHEN coalesce(v_app.licensed, false) THEN 'contracting' ELSE 'licensing' END;
    SELECT id INTO v_stage_id FROM public.pipeline_stages WHERE slug = v_target_slug;

    -- Idempotent hire: only stamp + count the first time.
    v_hired := v_app.hired_at IS NULL;

    UPDATE public.applicants
      SET evaluation_completed_at = now(),
          current_stage_id = coalesce(v_stage_id, current_stage_id),
          stage_entered_at = CASE WHEN v_stage_id IS NOT NULL THEN now() ELSE stage_entered_at END,
          hired_at = coalesce(hired_at, now()),
          updated_at = now()
      WHERE id = v_app.id;

    INSERT INTO public.applicant_activities (applicant_id, event_type, summary, data)
    VALUES (v_app.id, 'evaluation_submitted', 'Evaluation submitted — auto-hired', v_answers);

    IF v_hired THEN
      v_recruiter := coalesce(v_app.original_recruiter_id, v_app.assigned_recruiter_id, v_app.referred_by_profile_id);
      IF v_recruiter IS NOT NULL THEN
        UPDATE public.profiles SET hires = coalesce(hires,0) + 1 WHERE id = v_recruiter;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_eval_id,
    'matched', v_app.id IS NOT NULL,
    'hired', v_hired,
    'licensed', coalesce(v_app.licensed, false)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.submit_evaluation(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_evaluation(jsonb) TO anon, authenticated, service_role;
