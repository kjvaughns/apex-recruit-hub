ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS requested_overview_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_requested_overview(_token text, _at timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  UPDATE public.applicants
     SET requested_overview_at = _at
   WHERE confirmation_token = _token
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  INSERT INTO public.applicant_activities (applicant_id, event_type, summary, data)
  VALUES (v_id, 'overview_slot_selected',
          'Applicant selected an overview date on the application',
          jsonb_build_object('requested_overview_at', _at));

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_overview_prefill(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.applicants%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.applicants WHERE confirmation_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  RETURN jsonb_build_object(
    'found', true,
    'requested_overview_at', r.requested_overview_at,
    'first_name', r.first_name,
    'last_name', r.last_name,
    'email', r.email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_requested_overview(text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_overview_prefill(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_requested_overview(text, timestamptz) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_overview_prefill(text) TO anon, authenticated, service_role;