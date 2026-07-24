
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_receive_applicants boolean NOT NULL DEFAULT true;

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS referred_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_by_name text;

CREATE INDEX IF NOT EXISTS idx_applicants_referred_by_profile ON public.applicants(referred_by_profile_id);

-- Update submit_application to also populate referred_by_profile_id / referred_by_name
CREATE OR REPLACE FUNCTION public.submit_application(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_first text := trim(coalesce(payload->>'first_name',''));
  v_last  text := trim(coalesce(payload->>'last_name',''));
  v_email text := lower(trim(coalesce(payload->>'email','')));
  v_phone text := trim(coalesce(payload->>'phone',''));
  v_ref_slug text := lower(trim(coalesce(payload->>'ref_slug','')));
  v_ref_profile_id uuid := nullif(payload->>'referred_by_profile_id','')::uuid;
  v_ref_name text := trim(coalesce(payload->>'referred_by_name',''));
  v_licensed boolean := coalesce((payload->>'licensed')::boolean, false);
  v_stage_id uuid;
  v_source_id uuid;
  v_recruiter_id uuid;
  v_manager_id uuid;
  v_team_id uuid;
  v_id uuid;
  v_token text := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  v_type text := CASE WHEN v_licensed THEN 'licensed' ELSE 'unlicensed' END;
BEGIN
  IF v_first = '' OR v_last = '' OR v_email = '' OR v_phone = '' THEN
    RAISE EXCEPTION 'Missing required fields';
  END IF;

  SELECT id INTO v_stage_id FROM public.pipeline_stages WHERE slug = 'new-applicant';

  IF v_ref_profile_id IS NOT NULL THEN
    SELECT id, team_id, manager_id INTO v_recruiter_id, v_team_id, v_manager_id
      FROM public.profiles
      WHERE id = v_ref_profile_id AND is_active = true;
  END IF;

  IF v_recruiter_id IS NULL AND v_ref_slug <> '' THEN
    SELECT id, team_id, manager_id INTO v_recruiter_id, v_team_id, v_manager_id
      FROM public.profiles
      WHERE lower(recruiting_slug) = v_ref_slug AND is_active = true;
  END IF;

  IF v_recruiter_id IS NOT NULL OR v_ref_name <> '' THEN
    SELECT id INTO v_source_id FROM public.applicant_sources WHERE slug = 'referral';
  ELSE
    SELECT id INTO v_source_id FROM public.applicant_sources WHERE slug = 'direct';
  END IF;

  INSERT INTO public.applicants (
    first_name, last_name, email, phone,
    date_of_birth, address, city, state, zip,
    licensed, why_text, consent_contact,
    source_id, source_details, ref_slug,
    original_recruiter_id, assigned_recruiter_id, assigned_manager_id, team_id,
    referred_by_profile_id, referred_by_name,
    current_stage_id, stage_entered_at,
    confirmation_token, success_page_type
  ) VALUES (
    v_first, v_last, v_email, v_phone,
    nullif(payload->>'date_of_birth','')::date,
    nullif(payload->>'address',''),
    nullif(payload->>'city',''),
    nullif(payload->>'state',''),
    nullif(payload->>'zip',''),
    v_licensed,
    nullif(payload->>'why_text',''),
    coalesce((payload->>'consent_contact')::boolean, true),
    v_source_id,
    CASE WHEN v_recruiter_id IS NULL AND v_ref_name <> ''
         THEN 'Referrer typed by applicant: ' || v_ref_name
         ELSE NULL END,
    nullif(v_ref_slug,''),
    v_recruiter_id, v_recruiter_id, v_manager_id, v_team_id,
    v_recruiter_id, nullif(v_ref_name,''),
    v_stage_id, now(),
    v_token, v_type
  )
  RETURNING id INTO v_id;

  INSERT INTO public.applicant_activities (applicant_id, event_type, summary, data)
  VALUES (v_id, 'application_submitted', 'Application submitted from public site',
          jsonb_build_object(
            'ref_slug', v_ref_slug,
            'recruiter_id', v_recruiter_id,
            'referred_by_name', nullif(v_ref_name, ''),
            'licensed', v_licensed
          ));

  RETURN jsonb_build_object('id', v_id, 'token', v_token, 'success_page_type', v_type, 'recruiter_id', v_recruiter_id);
END;
$function$;
