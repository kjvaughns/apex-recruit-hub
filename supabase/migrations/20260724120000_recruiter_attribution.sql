-- =========================================================================
-- APEX Financial — Recruiter attribution, slugs & safe public recruiter search
-- =========================================================================

-- ---- 1. profiles: recruiting permission ---------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_receive_applicants boolean NOT NULL DEFAULT true;

-- ---- 2. applicants: attribution + audit columns -------------------------
-- (existing: assigned_recruiter_id, original_recruiter_id, assigned_manager_id,
--  team_id, ref_slug, state, licensed, licensing_status, why_text are reused)
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS referred_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_by_name_snapshot text,
  ADD COLUMN IF NOT EXISTS original_referral_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_referral_name_snapshot text,
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS referral_landing_url text,
  ADD COLUMN IF NOT EXISTS invalid_referral_slug text,
  ADD COLUMN IF NOT EXISTS instagram_handle text;

CREATE INDEX IF NOT EXISTS applicants_referred_by_idx ON public.applicants (referred_by_profile_id);

-- ---- 3. Recruiting-slug generation --------------------------------------
CREATE OR REPLACE FUNCTION public.slugify_name(_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(_text, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- BEFORE INSERT trigger: derive a stable, URL-safe slug when none is provided.
-- The 6-char id suffix guarantees uniqueness without exposing the full UUID.
CREATE OR REPLACE FUNCTION public.set_recruiting_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_base text;
BEGIN
  IF NEW.recruiting_slug IS NULL OR trim(NEW.recruiting_slug) = '' THEN
    v_base := public.slugify_name(trim(coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, '')));
    v_base := coalesce(nullif(v_base, ''), 'agent');
    NEW.recruiting_slug := v_base || '-' || substr(replace(NEW.id::text, '-', ''), 1, 6);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_slug ON public.profiles;
CREATE TRIGGER profiles_set_slug
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_recruiting_slug();

-- Backfill existing profiles that have no slug yet.
UPDATE public.profiles
SET recruiting_slug =
      coalesce(nullif(public.slugify_name(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))), ''), 'agent')
      || '-' || substr(replace(id::text, '-', ''), 1, 6)
WHERE recruiting_slug IS NULL OR trim(recruiting_slug) = '';

-- ---- 4. Safe public recruiter search ------------------------------------
-- Returns ONLY non-sensitive fields; the profiles table stays unreadable to
-- anon (no anon SELECT policy). SECURITY DEFINER (owned by postgres) bypasses
-- RLS, matching the existing submit_application / resolve_scheduling_context
-- pattern.
CREATE OR REPLACE FUNCTION public.search_recruiters(_q text)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  recruiting_slug text,
  team_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.recruiting_slug, t.name AS team_name
  FROM public.profiles p
  LEFT JOIN public.teams t ON t.id = p.team_id
  WHERE p.is_active = true
    AND p.can_receive_applicants = true
    AND p.recruiting_slug IS NOT NULL
    AND (
      coalesce(trim(_q), '') = ''
      OR p.full_name ILIKE '%' || _q || '%'
      OR p.first_name ILIKE '%' || _q || '%'
      OR p.last_name ILIKE '%' || _q || '%'
    )
  ORDER BY
    CASE
      WHEN p.full_name ILIKE _q || '%' THEN 0
      WHEN p.first_name ILIKE _q || '%' OR p.last_name ILIKE _q || '%' THEN 1
      ELSE 2
    END,
    p.full_name
  LIMIT 8;
$$;

REVOKE ALL ON FUNCTION public.search_recruiters(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_recruiters(text) TO anon, authenticated, service_role;

-- Resolve a single active recruiter from a referral slug (for link preselect).
CREATE OR REPLACE FUNCTION public.get_recruiter_by_slug(_slug text)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  recruiting_slug text,
  team_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.recruiting_slug, t.name AS team_name
  FROM public.profiles p
  LEFT JOIN public.teams t ON t.id = p.team_id
  WHERE lower(p.recruiting_slug) = lower(trim(_slug))
    AND p.is_active = true
    AND p.can_receive_applicants = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_recruiter_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recruiter_by_slug(text) TO anon, authenticated, service_role;

-- ---- 5. submit_application: validated recruiter + full attribution -------
CREATE OR REPLACE FUNCTION public.submit_application(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_first text := trim(coalesce(payload->>'first_name', ''));
  v_last  text := trim(coalesce(payload->>'last_name', ''));
  v_email text := lower(trim(coalesce(payload->>'email', '')));
  v_phone text := trim(coalesce(payload->>'phone', ''));
  v_state text := nullif(upper(trim(coalesce(payload->>'state', ''))), '');
  v_licensed boolean := coalesce((payload->>'licensed')::boolean, false);
  v_referred_by uuid := nullif(payload->>'referred_by_profile_id', '')::uuid;
  v_original_ref uuid := nullif(payload->>'original_referral_profile_id', '')::uuid;
  v_referral_source text := nullif(trim(coalesce(payload->>'referral_source', '')), '');
  v_referral_slug text := nullif(lower(trim(coalesce(payload->>'referral_slug', ''))), '');
  v_landing_url text := nullif(trim(coalesce(payload->>'referral_landing_url', '')), '');
  v_invalid_slug text := nullif(trim(coalesce(payload->>'invalid_referral_slug', '')), '');
  v_instagram text := nullif(trim(coalesce(payload->>'instagram_handle', '')), '');

  v_stage_id uuid;
  v_source_id uuid;
  v_rec_name text;
  v_rec_team uuid;
  v_rec_manager uuid;
  v_is_manager boolean := false;
  v_orig_name text;
  v_assigned_recruiter uuid;
  v_assigned_manager uuid;
  v_team uuid;
  v_original_recruiter uuid;
  v_id uuid;
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_type text := CASE WHEN v_licensed THEN 'licensed' ELSE 'unlicensed' END;
BEGIN
  IF v_first = '' OR v_last = '' OR v_email = '' OR v_phone = '' THEN
    RAISE EXCEPTION 'Missing required fields';
  END IF;

  IF v_referred_by IS NULL THEN
    RAISE EXCEPTION 'A referring recruiter must be selected';
  END IF;

  -- Selected recruiter must be a real active, recruiting profile.
  SELECT p.full_name, p.team_id, p.manager_id
    INTO v_rec_name, v_rec_team, v_rec_manager
    FROM public.profiles p
    WHERE p.id = v_referred_by AND p.is_active = true AND p.can_receive_applicants = true;

  IF v_rec_name IS NULL THEN
    RAISE EXCEPTION 'Selected recruiter is not a valid active agent';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_referred_by AND role IN ('manager', 'admin', 'super_admin')
  ) INTO v_is_manager;

  -- Assignment (spec §13): agent -> agent + their manager/team;
  -- manager -> the manager directly (no separate routing-rules table exists).
  IF v_is_manager THEN
    v_assigned_recruiter := v_referred_by;
    v_assigned_manager := v_referred_by;
    v_team := v_rec_team;
  ELSE
    v_assigned_recruiter := v_referred_by;
    v_assigned_manager := v_rec_manager;
    v_team := v_rec_team;
  END IF;

  -- Original attribution snapshot (from the referral link, when present).
  IF v_original_ref IS NOT NULL THEN
    SELECT p.full_name INTO v_orig_name FROM public.profiles p WHERE p.id = v_original_ref;
  END IF;
  v_original_recruiter := coalesce(v_original_ref, v_referred_by);

  SELECT id INTO v_stage_id FROM public.pipeline_stages WHERE slug = 'new-applicant';
  SELECT id INTO v_source_id FROM public.applicant_sources WHERE slug = 'referral';

  INSERT INTO public.applicants (
    first_name, last_name, email, phone,
    state, licensed, licensing_status, why_text, consent_contact,
    instagram_handle,
    source_id, ref_slug,
    referred_by_profile_id, referred_by_name_snapshot,
    original_referral_profile_id, original_referral_name_snapshot,
    referral_source, referral_landing_url, invalid_referral_slug,
    original_recruiter_id, assigned_recruiter_id, assigned_manager_id, team_id,
    current_stage_id, stage_entered_at,
    confirmation_token, success_page_type
  ) VALUES (
    v_first, v_last, v_email, v_phone,
    v_state, v_licensed, v_type, nullif(payload->>'why_text', ''),
    coalesce((payload->>'consent_contact')::boolean, true),
    v_instagram,
    v_source_id, v_referral_slug,
    v_referred_by, v_rec_name,
    v_original_ref, v_orig_name,
    coalesce(v_referral_source, 'manual'), v_landing_url, v_invalid_slug,
    v_original_recruiter, v_assigned_recruiter, v_assigned_manager, v_team,
    v_stage_id, now(),
    v_token, v_type
  )
  RETURNING id INTO v_id;

  INSERT INTO public.applicant_activities (applicant_id, event_type, summary, data)
  VALUES (v_id, 'application_submitted', 'Application submitted from public site',
          jsonb_build_object(
            'referred_by_profile_id', v_referred_by,
            'original_referral_profile_id', v_original_ref,
            'referral_source', v_referral_source,
            'referral_slug', v_referral_slug,
            'invalid_referral_slug', v_invalid_slug,
            'licensed', v_licensed
          ));

  RETURN jsonb_build_object('id', v_id, 'token', v_token, 'success_page_type', v_type, 'recruiter_id', v_assigned_recruiter);
END;
$function$;
