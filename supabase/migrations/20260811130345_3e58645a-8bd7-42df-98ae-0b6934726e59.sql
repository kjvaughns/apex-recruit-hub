ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS one_on_one_calendly_url text,
  ADD COLUMN IF NOT EXISTS one_on_one_calendly_updated_at timestamptz;

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS wants_one_on_one boolean NOT NULL DEFAULT false;

INSERT INTO public.system_settings (key, value)
VALUES ('owner_one_on_one_calendly_url', '')
ON CONFLICT (key) DO NOTHING;

-- Nearest leader/manager/admin above (and including) a profile that has a 1:1 link.
CREATE OR REPLACE FUNCTION public.resolve_one_on_one_url(_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cur uuid := _profile_id;
  v_url text;
  v_hops int := 0;
BEGIN
  WHILE v_cur IS NOT NULL AND v_hops < 25 LOOP
    SELECT p.one_on_one_calendly_url INTO v_url
      FROM public.profiles p
     WHERE p.id = v_cur
       AND coalesce(p.one_on_one_calendly_url, '') <> ''
       AND EXISTS (
         SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = p.id
            AND ur.role IN ('leader', 'manager', 'admin', 'super_admin')
       );
    IF v_url IS NOT NULL AND v_url <> '' THEN
      RETURN v_url;
    END IF;
    SELECT p.parent_user_id INTO v_cur FROM public.profiles p WHERE p.id = v_cur;
    v_hops := v_hops + 1;
  END LOOP;

  SELECT nullif(s.value, '') INTO v_url
    FROM public.system_settings s
   WHERE s.key = 'owner_one_on_one_calendly_url';
  RETURN v_url;
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
    'email', r.email,
    'phone', r.phone,
    'referrer_name', coalesce(
      nullif(r.referred_by_name_snapshot, ''),
      nullif(r.referred_by_name, ''),
      (SELECT p.full_name FROM public.profiles p WHERE p.id = r.referred_by_profile_id)
    ),
    'wants_one_on_one', r.wants_one_on_one,
    'one_on_one_url', public.resolve_one_on_one_url(
      coalesce(r.assigned_recruiter_id, r.referred_by_profile_id, r.original_referral_profile_id)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_requested_overview(_token text, _at timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  UPDATE public.applicants
     SET requested_overview_at = _at,
         wants_one_on_one = (_at IS NULL)
   WHERE confirmation_token = _token
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  INSERT INTO public.applicant_activities (applicant_id, event_type, summary, data)
  VALUES (
    v_id,
    CASE WHEN _at IS NULL THEN 'one_on_one_requested' ELSE 'overview_slot_selected' END,
    CASE WHEN _at IS NULL
      THEN 'Applicant could not attend an overview date and requested a 1:1 call'
      ELSE 'Applicant selected an overview date on the application' END,
    jsonb_build_object('requested_overview_at', _at)
  );

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_one_on_one_url(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_overview_prefill(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_requested_overview(text, timestamptz) TO anon, authenticated, service_role;