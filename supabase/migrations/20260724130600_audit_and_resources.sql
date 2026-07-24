-- =========================================================================
-- APEX Portal — Audit log + resource permissions (Phase 7)
-- =========================================================================

-- ---- Resources: manager authorship + publish tracking --------------------
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Managers granted can_manage_resources may create and manage their own.
CREATE POLICY "resources_manager_write" ON public.resources
  FOR ALL TO authenticated
  USING (
    coalesce((SELECT can_manage_resources FROM public.profiles WHERE id = auth.uid()), false)
    AND created_by = auth.uid()
  )
  WITH CHECK (
    coalesce((SELECT can_manage_resources FROM public.profiles WHERE id = auth.uid()), false)
    AND created_by = auth.uid()
  );

-- ---- Audit log -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_applicant_id uuid REFERENCES public.applicants(id) ON DELETE SET NULL,
  previous_value jsonb,
  new_value jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs (action);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Any staff member may record an action they performed; only admins may read.
CREATE POLICY "staff insert audit" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND actor_id = auth.uid());
CREATE POLICY "admins read audit" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
