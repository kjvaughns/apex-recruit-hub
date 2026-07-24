-- =========================================================================
-- APEX Portal — Portal invitation system (Phase 2)
-- Authorized users invite existing agents into their hierarchy; invitees set
-- their own password + profile via a secure single-use token.
-- =========================================================================

-- ---- profiles: agent detail fields captured at acceptance ----------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS npn text,
  ADD COLUMN IF NOT EXISTS instagram_handle text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS licensed boolean NOT NULL DEFAULT false;

-- Link an applicant to the portal profile it became (also used by Phase 3).
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS portal_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ---- invitations ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  first_name text,
  last_name text,
  phone text,
  role public.app_role NOT NULL,
  parent_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  state text,
  licensed boolean NOT NULL DEFAULT false,
  npn text,
  instagram_handle text,
  notes text,
  can_invite_agents boolean NOT NULL DEFAULT false,
  can_invite_leaders boolean NOT NULL DEFAULT false,
  can_manage_resources boolean NOT NULL DEFAULT false,
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','cancelled')),
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  applicant_id uuid REFERENCES public.applicants(id) ON DELETE SET NULL,
  accepted_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invitations_email_idx ON public.invitations (lower(email));
CREATE INDEX IF NOT EXISTS invitations_invited_by_idx ON public.invitations (invited_by);
CREATE INDEX IF NOT EXISTS invitations_status_idx ON public.invitations (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS invitations_touch ON public.invitations;
CREATE TRIGGER invitations_touch BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: authorized users see invitations they sent or that target their downline.
CREATE POLICY "read own or downline invitations" ON public.invitations
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR invited_by = auth.uid()
    OR public.is_descendant(auth.uid(), parent_user_id)
    OR public.is_descendant(auth.uid(), invited_by)
  );
CREATE POLICY "admins manage invitations" ON public.invitations
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ---- Permission helper: which roles can _inviter grant? -------------------
CREATE OR REPLACE FUNCTION public.can_invite_role(_inviter uuid, _role text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text := public.get_primary_role(_inviter);
  inv_agents boolean;
  inv_leaders boolean;
BEGIN
  IF _role = 'super_admin' THEN RETURN false; END IF;
  IF r IN ('admin','super_admin') THEN RETURN true; END IF;
  IF r = 'manager' THEN RETURN _role IN ('leader','agent'); END IF;
  IF r = 'leader' THEN
    SELECT can_invite_agents, can_invite_leaders INTO inv_agents, inv_leaders
      FROM public.profiles WHERE id = _inviter;
    IF _role = 'agent' THEN RETURN coalesce(inv_agents, false); END IF;
    IF _role = 'leader' THEN RETURN coalesce(inv_leaders, false); END IF;
  END IF;
  RETURN false;
END;
$$;

-- ---- create_invitation ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_invitation(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_role text := lower(trim(coalesce(payload->>'role','')));
  v_email text := lower(trim(coalesce(payload->>'email','')));
  v_parent uuid := nullif(payload->>'parent_user_id','')::uuid;
  v_token text := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  v_existing uuid;
  v_id uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_email = '' THEN RAISE EXCEPTION 'Email is required'; END IF;
  IF NOT public.can_invite_role(v_caller, v_role) THEN
    RAISE EXCEPTION 'You are not permitted to invite a % account', v_role;
  END IF;

  -- Parent must be the inviter themselves or within their downline (admins: any).
  IF v_parent IS NOT NULL AND NOT public.is_admin(v_caller)
     AND v_parent <> v_caller AND NOT public.is_descendant(v_caller, v_parent) THEN
    RAISE EXCEPTION 'Assigned parent must be inside your organization';
  END IF;

  -- Duplicate prevention (spec §14).
  SELECT id INTO v_existing FROM public.profiles WHERE lower(email) = v_email LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'A portal account already exists for %', v_email;
  END IF;
  IF EXISTS (SELECT 1 FROM public.invitations WHERE lower(email) = v_email AND status = 'pending') THEN
    RAISE EXCEPTION 'A pending invitation already exists for %', v_email;
  END IF;

  INSERT INTO public.invitations (
    email, first_name, last_name, phone, role, parent_user_id, manager_id, team_id,
    state, licensed, npn, instagram_handle, notes,
    can_invite_agents, can_invite_leaders, can_manage_resources,
    invited_by, applicant_id, token
  ) VALUES (
    v_email,
    nullif(trim(payload->>'first_name'),''),
    nullif(trim(payload->>'last_name'),''),
    nullif(trim(payload->>'phone'),''),
    v_role::public.app_role,
    v_parent,
    nullif(payload->>'manager_id','')::uuid,
    nullif(payload->>'team_id','')::uuid,
    nullif(trim(payload->>'state'),''),
    coalesce((payload->>'licensed')::boolean, false),
    nullif(trim(payload->>'npn'),''),
    nullif(trim(payload->>'instagram_handle'),''),
    nullif(trim(payload->>'notes'),''),
    coalesce((payload->>'can_invite_agents')::boolean, false),
    coalesce((payload->>'can_invite_leaders')::boolean, false),
    coalesce((payload->>'can_manage_resources')::boolean, false),
    v_caller,
    nullif(payload->>'applicant_id','')::uuid,
    v_token
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'token', v_token);
END;
$$;

-- ---- cancel / resend -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_invitation(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.invitations%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.invitations WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF NOT (public.is_admin(auth.uid()) OR r.invited_by = auth.uid()
          OR public.is_descendant(auth.uid(), r.parent_user_id)) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  UPDATE public.invitations SET status = 'cancelled', updated_at = now() WHERE id = _id;
  RETURN jsonb_build_object('ok', true);
END;$$;

CREATE OR REPLACE FUNCTION public.resend_invitation(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.invitations%ROWTYPE;
  v_token text := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
BEGIN
  SELECT * INTO r FROM public.invitations WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF NOT (public.is_admin(auth.uid()) OR r.invited_by = auth.uid()
          OR public.is_descendant(auth.uid(), r.parent_user_id)) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF r.status = 'accepted' THEN RAISE EXCEPTION 'Invitation already accepted'; END IF;
  UPDATE public.invitations
    SET status = 'pending', token = v_token, expires_at = now() + interval '14 days', updated_at = now()
    WHERE id = _id;
  RETURN jsonb_build_object('ok', true, 'token', v_token);
END;$$;

-- ---- Public: fetch a safe view of an invitation by token -----------------
CREATE OR REPLACE FUNCTION public.get_invitation_public(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.invitations%ROWTYPE;
  v_expired boolean;
BEGIN
  SELECT * INTO r FROM public.invitations WHERE token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
  v_expired := r.expires_at < now();
  RETURN jsonb_build_object(
    'found', true,
    'status', CASE WHEN r.status = 'pending' AND v_expired THEN 'expired' ELSE r.status END,
    'email', r.email,
    'first_name', r.first_name,
    'last_name', r.last_name,
    'role', r.role::text,
    'state', r.state,
    'licensed', r.licensed,
    'npn', r.npn,
    'instagram_handle', r.instagram_handle,
    'phone', r.phone
  );
END;$$;
REVOKE ALL ON FUNCTION public.get_invitation_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_public(text) TO anon, authenticated, service_role;

-- ---- Finalize acceptance (called after the auth user is created) ---------
-- Wires the new profile into the hierarchy, grants the role, and single-uses
-- the token. Runs as definer so auth.uid() is NULL (structural guard allows it).
CREATE OR REPLACE FUNCTION public.finalize_invitation_acceptance(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.invitations%ROWTYPE;
  v_profile uuid := (payload->>'profile_id')::uuid;
BEGIN
  SELECT * INTO r FROM public.invitations WHERE token = (payload->>'token');
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Invitation is no longer valid'; END IF;
  IF r.expires_at < now() THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = r.id;
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  UPDATE public.profiles SET
    first_name = coalesce(r.first_name, first_name),
    last_name = coalesce(r.last_name, last_name),
    phone = coalesce(nullif(payload->>'phone',''), r.phone, phone),
    state = coalesce(nullif(payload->>'state',''), r.state),
    npn = coalesce(nullif(payload->>'npn',''), r.npn),
    instagram_handle = coalesce(nullif(payload->>'instagram_handle',''), r.instagram_handle),
    timezone = nullif(payload->>'timezone',''),
    licensed = coalesce((payload->>'licensed')::boolean, r.licensed),
    parent_user_id = r.parent_user_id,
    manager_id = r.manager_id,
    team_id = r.team_id,
    can_invite_agents = r.can_invite_agents,
    can_invite_leaders = r.can_invite_leaders,
    can_manage_resources = r.can_manage_resources,
    is_active = true,
    status = 'active',
    updated_at = now()
  WHERE id = v_profile;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_profile, r.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.invitations
    SET status = 'accepted', accepted_profile_id = v_profile, accepted_at = now(), updated_at = now()
    WHERE id = r.id;

  -- Link a promoted applicant back to the new portal profile, if applicable.
  IF r.applicant_id IS NOT NULL THEN
    UPDATE public.applicants SET portal_profile_id = v_profile, updated_at = now()
    WHERE id = r.applicant_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'invitation_id', r.id, 'role', r.role::text);
END;$$;
