-- Hierarchy foundation
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS parent_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS organization_path text,
  ADD COLUMN IF NOT EXISTS can_invite_agents boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_invite_leaders boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_resources boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS profiles_parent_idx ON public.profiles (parent_user_id);
CREATE INDEX IF NOT EXISTS profiles_org_path_idx ON public.profiles (organization_path text_pattern_ops);

CREATE OR REPLACE FUNCTION public.get_primary_role(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role::text FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role::text
    WHEN 'super_admin' THEN 5 WHEN 'admin' THEN 4 WHEN 'manager' THEN 3
    WHEN 'leader' THEN 2 WHEN 'agent' THEN 1 ELSE 0 END DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.descendant_ids(_root uuid)
RETURNS TABLE(id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE tree AS (
    SELECT p.id FROM public.profiles p WHERE p.parent_user_id = _root
    UNION
    SELECT c.id FROM public.profiles c JOIN tree t ON c.parent_user_id = t.id
  ) SELECT id FROM tree;
$$;

CREATE OR REPLACE FUNCTION public.is_descendant(_ancestor uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _target IS NOT NULL AND _ancestor IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.descendant_ids(_ancestor) d WHERE d.id = _target);
$$;

CREATE OR REPLACE FUNCTION public.can_access_user(_viewer uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _viewer = _target OR public.is_admin(_viewer) OR public.is_descendant(_viewer, _target);
$$;

CREATE OR REPLACE FUNCTION public.set_org_path()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE parent_path text;
BEGIN
  IF NEW.parent_user_id IS NULL THEN
    NEW.organization_path := '/' || NEW.id::text || '/';
  ELSE
    SELECT organization_path INTO parent_path FROM public.profiles WHERE id = NEW.parent_user_id;
    NEW.organization_path := coalesce(parent_path, '/' || NEW.parent_user_id::text || '/') || NEW.id::text || '/';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS profiles_org_path ON public.profiles;
CREATE TRIGGER profiles_org_path BEFORE INSERT OR UPDATE OF parent_user_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_org_path();

UPDATE public.profiles SET organization_path = '/' || id::text || '/' WHERE organization_path IS NULL;

CREATE OR REPLACE FUNCTION public.guard_profile_structural()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.parent_user_id IS DISTINCT FROM OLD.parent_user_id
     OR NEW.manager_id IS DISTINCT FROM OLD.manager_id
     OR NEW.team_id IS DISTINCT FROM OLD.team_id
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.can_invite_agents IS DISTINCT FROM OLD.can_invite_agents
     OR NEW.can_invite_leaders IS DISTINCT FROM OLD.can_invite_leaders
     OR NEW.can_manage_resources IS DISTINCT FROM OLD.can_manage_resources
     OR NEW.recruiting_slug IS DISTINCT FROM OLD.recruiting_slug THEN
    RAISE EXCEPTION 'You are not permitted to change hierarchy or permission fields on a profile';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS profiles_guard_structural ON public.profiles;
CREATE TRIGGER profiles_guard_structural BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_structural();

DROP POLICY IF EXISTS "manager reads team applicants" ON public.applicants;
DROP POLICY IF EXISTS "hierarchy reads downline applicants" ON public.applicants;
CREATE POLICY "hierarchy reads downline applicants" ON public.applicants
  FOR SELECT TO authenticated
  USING (public.is_descendant(auth.uid(), assigned_recruiter_id)
      OR public.is_descendant(auth.uid(), original_recruiter_id));

DROP POLICY IF EXISTS "hierarchy updates downline applicants" ON public.applicants;
CREATE POLICY "hierarchy updates downline applicants" ON public.applicants
  FOR UPDATE TO authenticated
  USING (public.is_descendant(auth.uid(), assigned_recruiter_id))
  WITH CHECK (public.is_descendant(auth.uid(), assigned_recruiter_id) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "staff inserts assignable applicants" ON public.applicants;
CREATE POLICY "staff inserts assignable applicants" ON public.applicants
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid())
    AND (assigned_recruiter_id = auth.uid()
      OR public.is_descendant(auth.uid(), assigned_recruiter_id)
      OR public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "admins manage non-owner roles" ON public.user_roles;
CREATE POLICY "admins manage non-owner roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND role::text <> 'super_admin')
  WITH CHECK (public.is_admin(auth.uid()) AND role::text <> 'super_admin');

-- Invitations
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS npn text,
  ADD COLUMN IF NOT EXISTS instagram_handle text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS licensed boolean NOT NULL DEFAULT false;

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS portal_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  first_name text, last_name text, phone text,
  role public.app_role NOT NULL,
  parent_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  state text, licensed boolean NOT NULL DEFAULT false,
  npn text, instagram_handle text, notes text,
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

DROP POLICY IF EXISTS "read own or downline invitations" ON public.invitations;
CREATE POLICY "read own or downline invitations" ON public.invitations
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR invited_by = auth.uid()
    OR public.is_descendant(auth.uid(), parent_user_id)
    OR public.is_descendant(auth.uid(), invited_by));

DROP POLICY IF EXISTS "admins manage invitations" ON public.invitations;
CREATE POLICY "admins manage invitations" ON public.invitations
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.can_invite_role(_inviter uuid, _role text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := public.get_primary_role(_inviter); inv_agents boolean; inv_leaders boolean;
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
END; $$;

CREATE OR REPLACE FUNCTION public.create_invitation(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_role text := lower(trim(coalesce(payload->>'role','')));
  v_email text := lower(trim(coalesce(payload->>'email','')));
  v_parent uuid := nullif(payload->>'parent_user_id','')::uuid;
  v_token text := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  v_existing uuid; v_id uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_email = '' THEN RAISE EXCEPTION 'Email is required'; END IF;
  IF NOT public.can_invite_role(v_caller, v_role) THEN
    RAISE EXCEPTION 'You are not permitted to invite a % account', v_role;
  END IF;
  IF v_parent IS NOT NULL AND NOT public.is_admin(v_caller)
     AND v_parent <> v_caller AND NOT public.is_descendant(v_caller, v_parent) THEN
    RAISE EXCEPTION 'Assigned parent must be inside your organization';
  END IF;
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
    nullif(trim(payload->>'first_name'),''), nullif(trim(payload->>'last_name'),''),
    nullif(trim(payload->>'phone'),''),
    v_role::public.app_role, v_parent,
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
    v_caller, nullif(payload->>'applicant_id','')::uuid, v_token
  ) RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'token', v_token);
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_invitation(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.invitations%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.invitations WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF NOT (public.is_admin(auth.uid()) OR r.invited_by = auth.uid()
          OR public.is_descendant(auth.uid(), r.parent_user_id)) THEN
    RAISE EXCEPTION 'Not permitted'; END IF;
  UPDATE public.invitations SET status = 'cancelled', updated_at = now() WHERE id = _id;
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.resend_invitation(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.invitations%ROWTYPE;
  v_token text := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
BEGIN
  SELECT * INTO r FROM public.invitations WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF NOT (public.is_admin(auth.uid()) OR r.invited_by = auth.uid()
          OR public.is_descendant(auth.uid(), r.parent_user_id)) THEN
    RAISE EXCEPTION 'Not permitted'; END IF;
  IF r.status = 'accepted' THEN RAISE EXCEPTION 'Invitation already accepted'; END IF;
  UPDATE public.invitations SET status = 'pending', token = v_token,
    expires_at = now() + interval '14 days', updated_at = now() WHERE id = _id;
  RETURN jsonb_build_object('ok', true, 'token', v_token);
END; $$;

CREATE OR REPLACE FUNCTION public.get_invitation_public(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.invitations%ROWTYPE; v_expired boolean;
BEGIN
  SELECT * INTO r FROM public.invitations WHERE token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
  v_expired := r.expires_at < now();
  RETURN jsonb_build_object(
    'found', true,
    'status', CASE WHEN r.status = 'pending' AND v_expired THEN 'expired' ELSE r.status END,
    'email', r.email, 'first_name', r.first_name, 'last_name', r.last_name,
    'role', r.role::text, 'state', r.state, 'licensed', r.licensed,
    'npn', r.npn, 'instagram_handle', r.instagram_handle, 'phone', r.phone);
END; $$;
REVOKE ALL ON FUNCTION public.get_invitation_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_public(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.finalize_invitation_acceptance(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.invitations%ROWTYPE; v_profile uuid := (payload->>'profile_id')::uuid;
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
    parent_user_id = r.parent_user_id, manager_id = r.manager_id, team_id = r.team_id,
    can_invite_agents = r.can_invite_agents, can_invite_leaders = r.can_invite_leaders,
    can_manage_resources = r.can_manage_resources,
    is_active = true, status = 'active', updated_at = now()
  WHERE id = v_profile;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_profile, r.role)
    ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.invitations SET status = 'accepted', accepted_profile_id = v_profile,
    accepted_at = now(), updated_at = now() WHERE id = r.id;
  IF r.applicant_id IS NOT NULL THEN
    UPDATE public.applicants SET portal_profile_id = v_profile, updated_at = now()
      WHERE id = r.applicant_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'invitation_id', r.id, 'role', r.role::text);
END; $$;

-- Promote applicant
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS promoted_to_agent_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_invitation_id uuid REFERENCES public.invitations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promoted_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.promote_applicant_to_agent(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF v_app.portal_profile_id IS NOT NULL THEN
    RAISE EXCEPTION 'This applicant already has a portal account';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'A portal account already exists for %', v_email;
  END IF;
  IF EXISTS (SELECT 1 FROM public.invitations WHERE lower(email) = v_email AND status = 'pending') THEN
    RAISE EXCEPTION 'A pending invitation already exists for %', v_email;
  END IF;
  INSERT INTO public.invitations (
    email, first_name, last_name, phone, role, parent_user_id, team_id,
    state, licensed, instagram_handle, invited_by, applicant_id, token
  ) VALUES (
    v_email,
    coalesce(nullif(payload->>'first_name',''), v_app.first_name),
    coalesce(nullif(payload->>'last_name',''), v_app.last_name),
    coalesce(nullif(payload->>'phone',''), v_app.phone),
    v_role::public.app_role, v_parent, v_team,
    coalesce(nullif(payload->>'state',''), v_app.state),
    coalesce((payload->>'licensed')::boolean, v_app.licensed),
    v_app.instagram_handle, v_caller, v_app.id, v_token
  ) RETURNING id INTO v_inv;
  SELECT id INTO v_stage FROM public.pipeline_stages WHERE slug = 'active-agent';
  UPDATE public.applicants SET
    current_stage_id = coalesce(v_stage, current_stage_id),
    stage_entered_at = CASE WHEN current_stage_id IS DISTINCT FROM v_stage THEN now() ELSE stage_entered_at END,
    promoted_to_agent_at = now(), promoted_by_user_id = v_caller,
    portal_invitation_id = v_inv, updated_at = now()
  WHERE id = v_app.id;
  INSERT INTO public.applicant_activities (applicant_id, actor_id, event_type, summary, data)
  VALUES (v_app.id, v_caller, 'promoted_to_agent',
          'Applicant promoted to agent — invitation created',
          jsonb_build_object('invitation_id', v_inv, 'role', v_role));
  RETURN jsonb_build_object('ok', true, 'invitation_id', v_inv, 'token', v_token);
END; $$;

-- Stage history
CREATE TABLE IF NOT EXISTS public.applicant_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  entered_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stage_history_applicant_idx ON public.applicant_stage_history (applicant_id, entered_at DESC);
GRANT SELECT, INSERT ON public.applicant_stage_history TO authenticated;
GRANT ALL ON public.applicant_stage_history TO service_role;
ALTER TABLE public.applicant_stage_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read stage history" ON public.applicant_stage_history;
CREATE POLICY "staff read stage history" ON public.applicant_stage_history
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_stage_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.current_stage_id IS NOT NULL THEN
      INSERT INTO public.applicant_stage_history (applicant_id, stage_id, changed_by)
      VALUES (NEW.id, NEW.current_stage_id, auth.uid());
    END IF;
  ELSIF NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id THEN
    INSERT INTO public.applicant_stage_history (applicant_id, stage_id, changed_by)
    VALUES (NEW.id, NEW.current_stage_id, auth.uid());
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS applicants_stage_history ON public.applicants;
CREATE TRIGGER applicants_stage_history AFTER INSERT OR UPDATE OF current_stage_id ON public.applicants
  FOR EACH ROW EXECUTE FUNCTION public.log_stage_history();

-- Company leaderboard
CREATE OR REPLACE FUNCTION public.company_leaderboard(payload jsonb)
RETURNS TABLE(profile_id uuid, full_name text, avatar_url text, role text,
  team_name text, manager_name text, new_count int, contacted_count int,
  scheduled_count int, completed_count int, promoted_count int,
  conversion numeric, total numeric, prev_total numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_metric text := coalesce(payload->>'metric', 'new_applicants');
  v_period text := coalesce(payload->>'period', 'month');
  v_role text := nullif(payload->>'role', '');
  v_team uuid := nullif(payload->>'team_id', '')::uuid;
  v_state text := nullif(payload->>'state', '');
  v_start timestamptz; v_prev_start timestamptz;
BEGIN
  v_start := CASE v_period
    WHEN 'today' THEN date_trunc('day', now())
    WHEN 'week' THEN date_trunc('week', now())
    WHEN 'month' THEN date_trunc('month', now())
    WHEN 'quarter' THEN date_trunc('quarter', now())
    WHEN 'year' THEN date_trunc('year', now())
    ELSE '-infinity'::timestamptz END;
  v_prev_start := CASE WHEN v_start = '-infinity'::timestamptz THEN '-infinity'::timestamptz
                       ELSE v_start - (now() - v_start) END;
  RETURN QUERY
  WITH cur AS (
    SELECT a.assigned_recruiter_id AS uid,
      count(*) FILTER (WHERE a.created_at >= v_start) AS new_c,
      count(*) FILTER (WHERE a.last_contacted_at >= v_start) AS cont_c,
      count(*) FILTER (WHERE a.calendly_scheduled_at >= v_start) AS sched_c,
      count(*) FILTER (WHERE a.evaluation_completed_at >= v_start) AS comp_c,
      count(*) FILTER (WHERE a.promoted_to_agent_at >= v_start) AS prom_c
    FROM public.applicants a
    WHERE a.assigned_recruiter_id IS NOT NULL
    GROUP BY a.assigned_recruiter_id
  ), prev AS (
    SELECT a.assigned_recruiter_id AS uid,
      count(*) FILTER (WHERE a.created_at >= v_prev_start AND a.created_at < v_start) AS new_p,
      count(*) FILTER (WHERE a.last_contacted_at >= v_prev_start AND a.last_contacted_at < v_start) AS cont_p,
      count(*) FILTER (WHERE a.calendly_scheduled_at >= v_prev_start AND a.calendly_scheduled_at < v_start) AS sched_p,
      count(*) FILTER (WHERE a.evaluation_completed_at >= v_prev_start AND a.evaluation_completed_at < v_start) AS comp_p,
      count(*) FILTER (WHERE a.promoted_to_agent_at >= v_prev_start AND a.promoted_to_agent_at < v_start) AS prom_p
    FROM public.applicants a
    WHERE a.assigned_recruiter_id IS NOT NULL
    GROUP BY a.assigned_recruiter_id
  )
  SELECT p.id, p.full_name, p.avatar_url,
    public.get_primary_role(p.id) AS role,
    t.name AS team_name, mgr.full_name AS manager_name,
    coalesce(cur.new_c, 0)::int, coalesce(cur.cont_c, 0)::int,
    coalesce(cur.sched_c, 0)::int, coalesce(cur.comp_c, 0)::int,
    coalesce(cur.prom_c, 0)::int,
    CASE WHEN coalesce(cur.new_c, 0) > 0
         THEN round(coalesce(cur.prom_c, 0)::numeric / cur.new_c, 3) ELSE 0 END AS conversion,
    (CASE v_metric
      WHEN 'contacted' THEN coalesce(cur.cont_c, 0)
      WHEN 'interviews_scheduled' THEN coalesce(cur.sched_c, 0)
      WHEN 'interviews_completed' THEN coalesce(cur.comp_c, 0)
      WHEN 'promoted' THEN coalesce(cur.prom_c, 0)
      ELSE coalesce(cur.new_c, 0) END)::numeric AS total,
    (CASE v_metric
      WHEN 'contacted' THEN coalesce(prev.cont_p, 0)
      WHEN 'interviews_scheduled' THEN coalesce(prev.sched_p, 0)
      WHEN 'interviews_completed' THEN coalesce(prev.comp_p, 0)
      WHEN 'promoted' THEN coalesce(prev.prom_p, 0)
      ELSE coalesce(prev.new_p, 0) END)::numeric AS prev_total
  FROM public.profiles p
  LEFT JOIN cur ON cur.uid = p.id
  LEFT JOIN prev ON prev.uid = p.id
  LEFT JOIN public.teams t ON t.id = p.team_id
  LEFT JOIN public.profiles mgr ON mgr.id = p.manager_id
  WHERE p.is_active = true
    AND (v_team IS NULL OR p.team_id = v_team)
    AND (v_state IS NULL OR p.state = v_state)
    AND (v_role IS NULL OR public.get_primary_role(p.id) = v_role)
  ORDER BY total DESC NULLS LAST, p.full_name;
END; $$;
REVOKE ALL ON FUNCTION public.company_leaderboard(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_leaderboard(jsonb) TO authenticated, service_role;

-- Audit + resources
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "resources_manager_write" ON public.resources;
CREATE POLICY "resources_manager_write" ON public.resources
  FOR ALL TO authenticated
  USING (coalesce((SELECT can_manage_resources FROM public.profiles WHERE id = auth.uid()), false)
    AND created_by = auth.uid())
  WITH CHECK (coalesce((SELECT can_manage_resources FROM public.profiles WHERE id = auth.uid()), false)
    AND created_by = auth.uid());

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_applicant_id uuid REFERENCES public.applicants(id) ON DELETE SET NULL,
  previous_value jsonb, new_value jsonb, metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs (action);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff insert audit" ON public.audit_logs;
CREATE POLICY "staff insert audit" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND actor_id = auth.uid());
DROP POLICY IF EXISTS "admins read audit" ON public.audit_logs;
CREATE POLICY "admins read audit" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));