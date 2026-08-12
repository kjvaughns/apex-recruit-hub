-- Onboarding: standalone checklist page (not a course).
--
-- Onboarding now lives only as the checklist page; applicants.onboarding_steps
-- stays the single source of truth. This migration:
--   1. Retires the duplicate Academy "vantage-onboarding" course.
--   2. Adds a 5th self-check step, 'complete_vantage_closer_course', that points
--      agents at the separate Vantage Closer Course (the initial required course).
--   3. Backfills existing onboarding records, grandfathering finished agents so
--      they are not un-completed by the new step.

-- 1. Retire the parallel onboarding course (FKs cascade to modules/lessons/enrollments).
DELETE FROM public.courses WHERE slug = 'vantage-onboarding';

-- academy_enroll's only caller (the onboarding welcome path) is removed, so drop
-- the now-unused SECURITY DEFINER helper. Course open still auto-enrolls via the
-- generic learner path.
DROP FUNCTION IF EXISTS public.academy_enroll(text, uuid);

-- 2. Add the 5th canonical step to the default seed used for new onboarding records.
CREATE OR REPLACE FUNCTION public.default_onboarding_steps()
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'agentspace_contracting',         jsonb_build_object('completed', false, 'completed_at', null),
    'discord_role_update',            jsonb_build_object('completed', false, 'completed_at', null),
    'portal_account_setup',           jsonb_build_object('completed', false, 'completed_at', null),
    'expectations_reviewed',          jsonb_build_object('completed', false, 'completed_at', null),
    'complete_vantage_closer_course', jsonb_build_object('completed', false, 'completed_at', null)
  );
$$;

-- 3. Whitelist the new step in the self-service update RPC. v_total derives from
--    v_valid, so done/total/complete recompute for the 5 steps automatically.
CREATE OR REPLACE FUNCTION public.update_onboarding(_step text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_app public.applicants%ROWTYPE;
  v_steps jsonb;
  v_valid text[] := ARRAY[
    'agentspace_contracting','discord_role_update','portal_account_setup',
    'expectations_reviewed','complete_vantage_closer_course'
  ];
  v_done int;
  v_total int := array_length(v_valid, 1);
  v_complete boolean;
  v_just_completed boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_app FROM public.applicants
    WHERE portal_profile_id = v_uid
    ORDER BY created_at DESC
    LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  v_steps := coalesce(v_app.onboarding_steps, public.default_onboarding_steps());

  IF _step IS NOT NULL AND _step <> '' THEN
    IF NOT (_step = ANY(v_valid)) THEN RAISE EXCEPTION 'Invalid onboarding step'; END IF;
    -- Only stamp the first time so the original completed_at is preserved.
    IF coalesce((v_steps -> _step ->> 'completed')::boolean, false) = false THEN
      v_steps := jsonb_set(
        v_steps, ARRAY[_step],
        jsonb_build_object('completed', true, 'completed_at', to_jsonb(now()))
      );
    END IF;
  END IF;

  SELECT count(*) INTO v_done
    FROM unnest(v_valid) k
    WHERE coalesce((v_steps -> k ->> 'completed')::boolean, false);
  v_complete := v_done = v_total;

  IF v_complete AND v_app.onboarding_completed_at IS NULL THEN
    v_just_completed := true;
    UPDATE public.applicants
      SET onboarding_steps = v_steps, onboarding_completed_at = now(), updated_at = now()
      WHERE id = v_app.id;
  ELSE
    UPDATE public.applicants
      SET onboarding_steps = v_steps, updated_at = now()
      WHERE id = v_app.id;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'applicant_id', v_app.id,
    'email', v_app.email,
    'first_name', v_app.first_name,
    'last_name', v_app.last_name,
    'steps', v_steps,
    'done', v_done,
    'total', v_total,
    'complete', v_complete,
    'just_completed', v_just_completed
  );
END;
$$;
REVOKE ALL ON FUNCTION public.update_onboarding(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_onboarding(text) TO authenticated, service_role;

-- 4. Backfill existing onboarding records with the new step. Grandfather agents
--    who already finished (mark the new step completed with their completion
--    time) so they stay complete; add it as incomplete for in-progress agents.
UPDATE public.applicants
SET onboarding_steps = onboarding_steps || jsonb_build_object(
  'complete_vantage_closer_course',
  jsonb_build_object(
    'completed', onboarding_completed_at IS NOT NULL,
    'completed_at', to_jsonb(onboarding_completed_at)
  )
)
WHERE onboarding_steps IS NOT NULL
  AND onboarding_steps <> '{}'::jsonb
  AND NOT (onboarding_steps ? 'complete_vantage_closer_course');

-- Keep the column comments honest (5 steps now).
COMMENT ON COLUMN public.applicants.onboarding_steps IS
  'Per-step onboarding progress {step: {completed, completed_at}} for the 5 canonical steps.';
COMMENT ON COLUMN public.applicants.onboarding_completed_at IS
  'When all 5 onboarding steps first completed. Guards the "Onboarding Complete" email.';