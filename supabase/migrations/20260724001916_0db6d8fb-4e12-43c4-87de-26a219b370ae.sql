
-- 1. applicants: token + tracking columns
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS confirmation_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS success_page_type text CHECK (success_page_type IN ('licensed','unlicensed')),
  ADD COLUMN IF NOT EXISTS calendly_url_used text,
  ADD COLUMN IF NOT EXISTS scheduled_event_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS scheduled_invitee_id text,
  ADD COLUMN IF NOT EXISTS scheduled_event_url text,
  ADD COLUMN IF NOT EXISTS scheduled_event_start timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_event_end timestamptz,
  ADD COLUMN IF NOT EXISTS scheduling_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS assigned_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. profiles: licensed calendly link + permission
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS licensed_calendly_url text,
  ADD COLUMN IF NOT EXISTS can_schedule_licensed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS licensed_calendly_updated_at timestamptz;

-- Allow managers to update their own licensed_calendly_url via existing profiles policies.
-- Existing profile policies (created earlier) already permit self-update; nothing to add.

-- 3. seed system settings
INSERT INTO public.system_settings (key, value)
VALUES
  ('unlicensed_overview_calendly_url', to_jsonb('https://calendly.com/kjvaughns1/overview?hide_event_type_details=1&hide_gdpr_banner=1&primary_color=e6b400'::text)),
  ('licensed_fallback_calendly_url', to_jsonb(''::text)),
  ('allow_recruiter_licensed_priority', to_jsonb(true)),
  ('allow_manager_licensed_priority', to_jsonb(true))
ON CONFLICT (key) DO NOTHING;

-- 4. Update submit_application: token + success page type + assigned manager + return token
CREATE OR REPLACE FUNCTION public.submit_application(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_first text := trim(coalesce(payload->>'first_name',''));
  v_last  text := trim(coalesce(payload->>'last_name',''));
  v_email text := lower(trim(coalesce(payload->>'email','')));
  v_phone text := trim(coalesce(payload->>'phone',''));
  v_ref_slug text := lower(trim(coalesce(payload->>'ref_slug','')));
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

  IF v_ref_slug <> '' THEN
    SELECT id, team_id, manager_id INTO v_recruiter_id, v_team_id, v_manager_id
      FROM public.profiles
      WHERE lower(recruiting_slug) = v_ref_slug AND is_active = true;
  END IF;

  IF v_recruiter_id IS NOT NULL THEN
    SELECT id INTO v_source_id FROM public.applicant_sources WHERE slug = 'referral';
  ELSE
    SELECT id INTO v_source_id FROM public.applicant_sources WHERE slug = 'direct';
  END IF;

  INSERT INTO public.applicants (
    first_name, last_name, email, phone,
    date_of_birth, address, city, state, zip,
    licensed, why_text, consent_contact,
    source_id, ref_slug,
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
    nullif(v_ref_slug,''),
    v_recruiter_id, v_recruiter_id, v_manager_id, v_team_id,
    v_stage_id, now(),
    v_token, v_type
  )
  RETURNING id INTO v_id;

  INSERT INTO public.applicant_activities (applicant_id, event_type, summary, data)
  VALUES (v_id, 'application_submitted', 'Application submitted from public site',
          jsonb_build_object('ref_slug', v_ref_slug, 'recruiter_id', v_recruiter_id, 'licensed', v_licensed));

  RETURN jsonb_build_object('id', v_id, 'token', v_token, 'success_page_type', v_type, 'recruiter_id', v_recruiter_id);
END;
$function$;

-- 5. Public token-gated scheduling context resolver
CREATE OR REPLACE FUNCTION public.resolve_scheduling_context(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.applicants%ROWTYPE;
  v_setting_unlicensed text;
  v_setting_fallback text;
  v_allow_recruiter boolean;
  v_allow_manager boolean;
  v_url text;
  v_contact_name text;
  v_contact_kind text;
  v_prof RECORD;
BEGIN
  SELECT * INTO r FROM public.applicants WHERE confirmation_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT value #>> '{}' INTO v_setting_unlicensed FROM public.system_settings WHERE key = 'unlicensed_overview_calendly_url';
  SELECT value #>> '{}' INTO v_setting_fallback FROM public.system_settings WHERE key = 'licensed_fallback_calendly_url';
  SELECT coalesce((value)::boolean, true) INTO v_allow_recruiter FROM public.system_settings WHERE key = 'allow_recruiter_licensed_priority';
  SELECT coalesce((value)::boolean, true) INTO v_allow_manager FROM public.system_settings WHERE key = 'allow_manager_licensed_priority';

  IF r.success_page_type = 'unlicensed' THEN
    v_url := coalesce(v_setting_unlicensed, 'https://calendly.com/kjvaughns1/overview?hide_event_type_details=1&hide_gdpr_banner=1&primary_color=e6b400');
    RETURN jsonb_build_object(
      'found', true,
      'first_name', r.first_name,
      'success_page_type', 'unlicensed',
      'calendly_url', v_url,
      'contact_name', null,
      'link_missing', false,
      'scheduling_status', r.scheduling_status
    );
  END IF;

  -- Licensed resolution priority
  IF v_allow_recruiter AND r.assigned_recruiter_id IS NOT NULL THEN
    SELECT p.licensed_calendly_url, coalesce(nullif(trim(p.full_name),''), p.email) AS n
      INTO v_prof
      FROM public.profiles p WHERE p.id = r.assigned_recruiter_id AND p.can_schedule_licensed = true;
    IF v_prof.licensed_calendly_url IS NOT NULL AND v_prof.licensed_calendly_url <> '' THEN
      v_url := v_prof.licensed_calendly_url; v_contact_name := v_prof.n; v_contact_kind := 'recruiter';
    END IF;
  END IF;

  IF v_url IS NULL AND v_allow_recruiter AND r.original_recruiter_id IS NOT NULL AND r.original_recruiter_id <> coalesce(r.assigned_recruiter_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    SELECT p.licensed_calendly_url, coalesce(nullif(trim(p.full_name),''), p.email) AS n
      INTO v_prof
      FROM public.profiles p WHERE p.id = r.original_recruiter_id AND p.can_schedule_licensed = true;
    IF v_prof.licensed_calendly_url IS NOT NULL AND v_prof.licensed_calendly_url <> '' THEN
      v_url := v_prof.licensed_calendly_url; v_contact_name := v_prof.n; v_contact_kind := 'recruiter';
    END IF;
  END IF;

  IF v_url IS NULL AND v_allow_manager AND r.assigned_manager_id IS NOT NULL THEN
    SELECT p.licensed_calendly_url, coalesce(nullif(trim(p.full_name),''), p.email) AS n
      INTO v_prof
      FROM public.profiles p WHERE p.id = r.assigned_manager_id;
    IF v_prof.licensed_calendly_url IS NOT NULL AND v_prof.licensed_calendly_url <> '' THEN
      v_url := v_prof.licensed_calendly_url; v_contact_name := v_prof.n; v_contact_kind := 'manager';
    END IF;
  END IF;

  IF v_url IS NULL AND v_allow_manager AND r.team_id IS NOT NULL THEN
    SELECT p.licensed_calendly_url, coalesce(nullif(trim(p.full_name),''), p.email) AS n
      INTO v_prof
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role IN ('manager','admin','super_admin')
      WHERE p.team_id = r.team_id
        AND p.licensed_calendly_url IS NOT NULL
        AND p.licensed_calendly_url <> ''
      LIMIT 1;
    IF v_prof.licensed_calendly_url IS NOT NULL THEN
      v_url := v_prof.licensed_calendly_url; v_contact_name := v_prof.n; v_contact_kind := 'team_manager';
    END IF;
  END IF;

  IF v_url IS NULL AND v_setting_fallback IS NOT NULL AND v_setting_fallback <> '' THEN
    v_url := v_setting_fallback; v_contact_kind := 'admin_fallback';
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'first_name', r.first_name,
    'success_page_type', 'licensed',
    'calendly_url', v_url,
    'contact_name', v_contact_name,
    'contact_kind', v_contact_kind,
    'link_missing', v_url IS NULL,
    'scheduling_status', r.scheduling_status
  );
END;
$function$;

-- 6. Idempotent mark-fallback: creates task + activity when a licensed applicant has no link
CREATE OR REPLACE FUNCTION public.mark_licensed_fallback(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.applicants%ROWTYPE;
  v_assignee uuid;
BEGIN
  SELECT * INTO r FROM public.applicants WHERE confirmation_token = _token;
  IF NOT FOUND OR r.success_page_type <> 'licensed' THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  IF r.scheduling_status = 'fallback' THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  v_assignee := coalesce(r.assigned_recruiter_id, r.assigned_manager_id);

  UPDATE public.applicants SET scheduling_status = 'fallback', updated_at = now() WHERE id = r.id;

  INSERT INTO public.applicant_activities (applicant_id, event_type, summary, data)
  VALUES (r.id, 'licensed_fallback', 'Licensed applicant submitted but no Calendly link configured',
          jsonb_build_object('assignee', v_assignee));

  IF v_assignee IS NOT NULL THEN
    INSERT INTO public.tasks (title, notes, priority, assigned_to, applicant_id)
    VALUES (
      'Follow up with licensed applicant ' || r.first_name || ' ' || r.last_name,
      'No licensed Calendly link was available at submission. Reach out to schedule the interview.',
      'high', v_assignee, r.id
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- 7. Public token-gated mark scheduled (best-effort when user clicks "I've booked")
CREATE OR REPLACE FUNCTION public.mark_scheduled_by_token(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.applicants%ROWTYPE;
  v_stage uuid;
BEGIN
  SELECT * INTO r FROM public.applicants WHERE confirmation_token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('matched', false); END IF;

  SELECT id INTO v_stage FROM public.pipeline_stages WHERE slug = 'interview-scheduled';

  UPDATE public.applicants
    SET calendly_scheduled_at = coalesce(calendly_scheduled_at, now()),
        scheduling_status = CASE WHEN scheduling_status IN ('scheduled') THEN scheduling_status ELSE 'scheduled' END,
        current_stage_id = coalesce(v_stage, current_stage_id),
        stage_entered_at = CASE WHEN current_stage_id IS DISTINCT FROM v_stage THEN now() ELSE stage_entered_at END,
        updated_at = now()
    WHERE id = r.id;

  INSERT INTO public.applicant_activities (applicant_id, event_type, summary)
  VALUES (r.id, 'appointment_scheduled_self_reported', 'Applicant confirmed booking via success page');

  RETURN jsonb_build_object('matched', true, 'id', r.id);
END;
$function$;
