
CREATE OR REPLACE FUNCTION public.resolve_scheduling_context(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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

  SELECT value INTO v_setting_unlicensed FROM public.system_settings WHERE key = 'unlicensed_overview_calendly_url';
  SELECT value INTO v_setting_fallback FROM public.system_settings WHERE key = 'licensed_fallback_calendly_url';
  SELECT coalesce(nullif(value,'')::boolean, true) INTO v_allow_recruiter FROM public.system_settings WHERE key = 'allow_recruiter_licensed_priority';
  SELECT coalesce(nullif(value,'')::boolean, true) INTO v_allow_manager FROM public.system_settings WHERE key = 'allow_manager_licensed_priority';

  IF r.success_page_type = 'unlicensed' THEN
    v_url := coalesce(nullif(v_setting_unlicensed,''), 'https://calendly.com/kjvaughns1/overview?hide_event_type_details=1&hide_gdpr_banner=1&primary_color=e6b400');
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
