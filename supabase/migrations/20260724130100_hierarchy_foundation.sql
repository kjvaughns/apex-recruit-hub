-- =========================================================================
-- APEX Portal — Organization hierarchy foundation
-- Roles: Admin > Manager > Leader > Agent (unlimited nested Leaders).
-- super_admin stays as a protected internal owner level (not a portal role).
-- =========================================================================

-- ---- 1. profiles: hierarchy + permission columns ------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS parent_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS organization_path text,
  ADD COLUMN IF NOT EXISTS can_invite_agents boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_invite_leaders boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_resources boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS profiles_parent_idx ON public.profiles (parent_user_id);
CREATE INDEX IF NOT EXISTS profiles_org_path_idx ON public.profiles (organization_path text_pattern_ops);

-- ---- 2. Role helpers -----------------------------------------------------
-- Highest-precedence role for a user (owner > admin > manager > leader > agent).
CREATE OR REPLACE FUNCTION public.get_primary_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role::text
    WHEN 'super_admin' THEN 5
    WHEN 'admin' THEN 4
    WHEN 'manager' THEN 3
    WHEN 'leader' THEN 2
    WHEN 'agent' THEN 1
    ELSE 0
  END DESC
  LIMIT 1;
$$;

-- ---- 3. Recursive downline resolution -----------------------------------
-- All profile ids nested beneath _root via parent_user_id (any depth).
CREATE OR REPLACE FUNCTION public.descendant_ids(_root uuid)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    SELECT p.id FROM public.profiles p WHERE p.parent_user_id = _root
    UNION
    SELECT c.id FROM public.profiles c JOIN tree t ON c.parent_user_id = t.id
  )
  SELECT id FROM tree;
$$;

CREATE OR REPLACE FUNCTION public.is_descendant(_ancestor uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _target IS NOT NULL
    AND _ancestor IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.descendant_ids(_ancestor) d WHERE d.id = _target);
$$;

-- Viewer may access target user's records: self, admin, or anywhere in downline.
CREATE OR REPLACE FUNCTION public.can_access_user(_viewer uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _viewer = _target
      OR public.is_admin(_viewer)
      OR public.is_descendant(_viewer, _target);
$$;

-- ---- 4. organization_path maintenance -----------------------------------
CREATE OR REPLACE FUNCTION public.set_org_path()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_path text;
BEGIN
  IF NEW.parent_user_id IS NULL THEN
    NEW.organization_path := '/' || NEW.id::text || '/';
  ELSE
    SELECT organization_path INTO parent_path FROM public.profiles WHERE id = NEW.parent_user_id;
    NEW.organization_path := coalesce(parent_path, '/' || NEW.parent_user_id::text || '/') || NEW.id::text || '/';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_org_path ON public.profiles;
CREATE TRIGGER profiles_org_path
  BEFORE INSERT OR UPDATE OF parent_user_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_org_path();

UPDATE public.profiles SET organization_path = '/' || id::text || '/' WHERE organization_path IS NULL;

-- ---- 5. Guard structural fields (spec §25) ------------------------------
-- Users may not change their own role/parent/team/permissions. auth.uid() is
-- NULL under the service role / SECURITY DEFINER context, which is allowed so
-- server-side flows (invitation acceptance, promotions) can set these.
CREATE OR REPLACE FUNCTION public.guard_profile_structural()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
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
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_structural ON public.profiles;
CREATE TRIGGER profiles_guard_structural
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_structural();

-- ---- 6. Applicant access by hierarchy (replaces flat team policy) --------
DROP POLICY IF EXISTS "manager reads team applicants" ON public.applicants;

CREATE POLICY "hierarchy reads downline applicants" ON public.applicants
  FOR SELECT TO authenticated
  USING (
    public.is_descendant(auth.uid(), assigned_recruiter_id)
    OR public.is_descendant(auth.uid(), original_recruiter_id)
  );

CREATE POLICY "hierarchy updates downline applicants" ON public.applicants
  FOR UPDATE TO authenticated
  USING (public.is_descendant(auth.uid(), assigned_recruiter_id))
  WITH CHECK (
    public.is_descendant(auth.uid(), assigned_recruiter_id)
    OR public.is_admin(auth.uid())
  );

-- Staff may create applicants they assign to themselves or their downline
-- (manual applicant entry, spec §16). Admins covered by "admins manage".
CREATE POLICY "staff inserts assignable applicants" ON public.applicants
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid())
    AND (
      assigned_recruiter_id = auth.uid()
      OR public.is_descendant(auth.uid(), assigned_recruiter_id)
      OR public.is_admin(auth.uid())
    )
  );

-- ---- 7. Role management: Admins manage non-owner roles -------------------
-- (super_admin/owner role remains manageable only by an existing owner.)
CREATE POLICY "admins manage non-owner roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND role::text <> 'super_admin')
  WITH CHECK (public.is_admin(auth.uid()) AND role::text <> 'super_admin');

-- Staff may read profiles they are allowed to see for org display. The existing
-- "staff read profiles" policy already permits staff to read profiles; hierarchy
-- filtering for private data happens at the applicant/CRM layer.
