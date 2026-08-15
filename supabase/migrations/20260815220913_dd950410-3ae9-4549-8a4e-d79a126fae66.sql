CREATE OR REPLACE FUNCTION public.default_onboarding_steps()
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'agent_cloud_onboarding',         jsonb_build_object('completed', false, 'completed_at', null),
    'discord_role_update',            jsonb_build_object('completed', false, 'completed_at', null),
    'read_agent_playbook',            jsonb_build_object('completed', false, 'completed_at', null),
    'agent_expectations_schedule',    jsonb_build_object('completed', false, 'completed_at', null),
    'complete_vantage_closer_course', jsonb_build_object('completed', false, 'completed_at', null)
  );
$$;

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
    'agent_cloud_onboarding','discord_role_update','read_agent_playbook',
    'agent_expectations_schedule','complete_vantage_closer_course'
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

  IF v_steps ? 'agentspace_contracting' AND NOT (v_steps ? 'agent_cloud_onboarding') THEN
    v_steps := (v_steps - 'agentspace_contracting')
      || jsonb_build_object('agent_cloud_onboarding', v_steps -> 'agentspace_contracting');
  END IF;

  IF _step IS NOT NULL AND _step <> '' THEN
    IF NOT (_step = ANY(v_valid)) THEN RAISE EXCEPTION 'Invalid onboarding step'; END IF;
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

UPDATE public.applicants
SET onboarding_steps =
  (onboarding_steps - 'agentspace_contracting')
  || jsonb_build_object('agent_cloud_onboarding', onboarding_steps -> 'agentspace_contracting')
WHERE onboarding_steps ? 'agentspace_contracting';