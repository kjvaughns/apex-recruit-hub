-- =========================================================================
-- APEX Portal — Applicant → Agent promotion (Phase 3)
-- Promotion never creates a portal account directly; it creates a secure
-- invitation the applicant accepts. The applicant record is preserved and
-- linked to the resulting profile.
-- =========================================================================

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS promoted_to_agent_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_invitation_id uuid REFERENCES public.invitations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promoted_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.promote_applicant_to_agent(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_app public.applicants%ROWTYPE;
  v_role text := lower(coalesce(nullif(payload->>'role',''), 'agent'));
  v_email text := lower(trim(coalesce(payload->>'email','')));
  v_parent uuid := nullif(payload->>'parent_user_id','')::uuid;
  v_team uuid := nullif(payload->>'team_id','')::uuid;
  v_stage uuid;
  v_token text := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  v_inv uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_app FROM public.applicants WHERE id = (payload->>'applicant_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Applicant not found'; END IF;

  -- Access: admin, or the applicant is within the caller's downline.
  IF NOT (public.is_admin(v_caller)
          OR public.is_descendant(v_caller, v_app.assigned_recruiter_id)
          OR public.is_descendant(v_caller, v_app.original_recruiter_id)
          OR v_app.assigned_recruiter_id = v_caller) THEN
    RAISE EXCEPTION 'You do not have access to this applicant';
  END IF;

  IF NOT public.can_invite_role(v_caller, v_role) THEN
    RAISE EXCEPTION 'You are not permitted to promote to %', v_role;
  END IF;

  IF v_email = '' THEN v_email := lower(trim(v_app.email)); END IF;

  -- Duplicate prevention (spec §14).
  IF v_app.portal_profile_id IS NOT NULL THEN
    RAISE EXCEPTION 'This applicant already has a portal account';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'A portal account already exists for %', v_email;
  END IF;
  IF EXISTS (SELECT 1 FROM public.invitations WHERE lower(email) = v_email AND status = 'pending') THEN
    RAISE EXCEPTION 'A pending invitation already exists for %', v_email;
  END IF;

  -- Create the secure invitation, linked back to the applicant.
  INSERT INTO public.invitations (
    email, first_name, last_name, phone, role, parent_user_id, team_id,
    state, licensed, instagram_handle, invited_by, applicant_id, token
  ) VALUES (
    v_email,
    coalesce(nullif(payload->>'first_name',''), v_app.first_name),
    coalesce(nullif(payload->>'last_name',''), v_app.last_name),
    coalesce(nullif(payload->>'phone',''), v_app.phone),
    v_role::public.app_role,
    v_parent, v_team,
    coalesce(nullif(payload->>'state',''), v_app.state),
    coalesce((payload->>'licensed')::boolean, v_app.licensed),
    v_app.instagram_handle,
    v_caller,
    v_app.id,
    v_token
  ) RETURNING id INTO v_inv;

  -- Move the applicant to Active Agent and record the promotion.
  SELECT id INTO v_stage FROM public.pipeline_stages WHERE slug = 'active-agent';
  UPDATE public.applicants SET
    current_stage_id = coalesce(v_stage, current_stage_id),
    stage_entered_at = CASE WHEN current_stage_id IS DISTINCT FROM v_stage THEN now() ELSE stage_entered_at END,
    promoted_to_agent_at = now(),
    promoted_by_user_id = v_caller,
    portal_invitation_id = v_inv,
    updated_at = now()
  WHERE id = v_app.id;

  INSERT INTO public.applicant_activities (applicant_id, actor_id, event_type, summary, data)
  VALUES (v_app.id, v_caller, 'promoted_to_agent',
          'Applicant promoted to agent — invitation created',
          jsonb_build_object('invitation_id', v_inv, 'role', v_role));

  RETURN jsonb_build_object('ok', true, 'invitation_id', v_inv, 'token', v_token);
END;
$$;
