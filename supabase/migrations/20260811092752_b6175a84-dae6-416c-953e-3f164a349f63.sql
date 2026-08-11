-- Onboarding Module — Phase 4: agent self-service step updates.
--
-- An onboarding agent is linked to their applicant record via
-- applicants.portal_profile_id, but they are NOT the assigned recruiter, so
-- RLS blocks them from updating that row directly. This SECURITY DEFINER RPC
-- lets an authenticated agent update only their own onboarding steps, stamp
-- onboarding_completed_at when all 4 are done, and report just_completed so the
-- TS layer can send the (branded) "Onboarding Complete" email exactly once.

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
    'agentspace_contracting','discord_role_update','portal_account_setup','expectations_reviewed'
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