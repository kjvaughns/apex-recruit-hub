
-- Public recruiter directory (active profiles only, no PII)
CREATE OR REPLACE FUNCTION public.search_recruiters(_q text)
RETURNS TABLE(id uuid, full_name text, avatar_url text, recruiting_slug text, team_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id,
         COALESCE(NULLIF(TRIM(p.full_name), ''),
                  NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                  p.email) AS full_name,
         p.avatar_url,
         p.recruiting_slug,
         t.name AS team_name
    FROM public.profiles p
    LEFT JOIN public.teams t ON t.id = p.team_id
   WHERE p.is_active = true
     AND (
       COALESCE(_q, '') = ''
       OR p.full_name ILIKE '%' || _q || '%'
       OR p.first_name ILIKE '%' || _q || '%'
       OR p.last_name ILIKE '%' || _q || '%'
       OR p.email ILIKE '%' || _q || '%'
       OR p.recruiting_slug ILIKE '%' || _q || '%'
     )
   ORDER BY full_name
   LIMIT 25
$$;

GRANT EXECUTE ON FUNCTION public.search_recruiters(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_recruiter_by_slug(_slug text)
RETURNS TABLE(id uuid, full_name text, avatar_url text, recruiting_slug text, team_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id,
         COALESCE(NULLIF(TRIM(p.full_name), ''),
                  NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                  p.email) AS full_name,
         p.avatar_url,
         p.recruiting_slug,
         t.name AS team_name
    FROM public.profiles p
    LEFT JOIN public.teams t ON t.id = p.team_id
   WHERE p.is_active = true
     AND lower(p.recruiting_slug) = lower(COALESCE(_slug, ''))
   LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_recruiter_by_slug(text) TO anon, authenticated;

-- Update submit_application: accept referred_by_profile_id (uuid) or referred_by_name (free text).
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

  -- Prefer explicit selected profile, fall back to slug
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

  IF v_recruiter_id IS NOT NULL THEN
    SELECT id INTO v_source_id FROM public.applicant_sources WHERE slug = 'referral';
  ELSIF v_ref_name <> '' THEN
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
