-- PR3: Evaluation system v2.
--
-- The expanded evaluation form still matches to the existing applicant record
-- (by embedded id or email) and never creates duplicates. On a match we now:
--   * move the applicant to "Interview Completed" and set recruiting_status = 'hired'
--     (replacing the old licensing/contracting-as-hired behavior),
--   * stamp evaluation_completed_at + hired_at (idempotent),
--   * compute a 0-100 internal guidance score (never auto-approves/rejects),
--   * log an "evaluation_completed" activity.
-- The now-unused Contracting stage is retired (its applicants roll to Onboarding).

-- Store the internal score alongside the response.
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS score integer;

-- Retire the Contracting stage now that the evaluation no longer targets it.
UPDATE public.applicants
  SET current_stage_id = (SELECT id FROM public.pipeline_stages WHERE slug = 'onboarding')
  WHERE current_stage_id = (SELECT id FROM public.pipeline_stages WHERE slug = 'contracting');
UPDATE public.pipeline_stages SET is_archived = true WHERE slug = 'contracting';

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
  v_stage_id uuid;
  v_recruiter uuid;
  v_hired boolean := false;
  v_score int := 0;
  v_hours int;
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

  -- Internal guidance score (0-100): commitment + availability + coachability +
  -- willingness to sell + commission comfort. Guidance only.
  v_hours := coalesce(nullif(regexp_replace(coalesce(v_answers->>'hours_per_week',''), '[^0-9]', '', 'g'), '')::int, 0);
  v_score :=
    CASE lower(coalesce(v_answers->>'time_commitment',''))
      WHEN 'full time plus' THEN 25 WHEN 'full time' THEN 18 WHEN 'part time' THEN 8 ELSE 0 END
    + CASE WHEN v_hours >= 40 THEN 15 WHEN v_hours >= 25 THEN 10 WHEN v_hours >= 15 THEN 6 ELSE 3 END
    + CASE WHEN lower(coalesce(v_answers->>'coachable','')) LIKE 'yes%' THEN 20 ELSE 0 END
    + CASE WHEN lower(coalesce(v_answers->>'willing_to_call','')) LIKE 'yes%' THEN 20 ELSE 0 END
    + CASE lower(coalesce(v_answers->>'commission_comfort',''))
      WHEN 'very comfortable' THEN 20 WHEN 'comfortable' THEN 14 WHEN 'unsure' THEN 6 ELSE 0 END;

  INSERT INTO public.evaluations (email, answers, applicant_id, matched, score)
  VALUES (v_email, v_answers, v_app.id, v_app.id IS NOT NULL, v_score)
  RETURNING id INTO v_eval_id;

  IF v_app.id IS NOT NULL THEN
    SELECT id INTO v_stage_id FROM public.pipeline_stages WHERE slug = 'interview-completed';

    -- Idempotent hire: only stamp + count the first time.
    v_hired := v_app.hired_at IS NULL;

    UPDATE public.applicants
      SET evaluation_completed_at = now(),
          recruiting_status = 'hired',
          current_stage_id = coalesce(v_stage_id, current_stage_id),
          stage_entered_at = CASE WHEN v_stage_id IS NOT NULL THEN now() ELSE stage_entered_at END,
          hired_at = coalesce(hired_at, now()),
          updated_at = now()
      WHERE id = v_app.id;

    INSERT INTO public.applicant_activities (applicant_id, event_type, summary, data)
    VALUES (v_app.id, 'evaluation_completed', 'Evaluation completed', jsonb_build_object('score', v_score));

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
    'score', v_score,
    'licensed', coalesce(v_app.licensed, false)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.submit_evaluation(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_evaluation(jsonb) TO anon, authenticated, service_role;
