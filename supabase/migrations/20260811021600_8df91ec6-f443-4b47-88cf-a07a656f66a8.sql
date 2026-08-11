-- Tighten applicant stage history visibility to match applicant visibility rules.
DROP POLICY IF EXISTS "staff read stage history" ON public.applicant_stage_history;
CREATE POLICY "staff reads stage history for readable applicants"
ON public.applicant_stage_history FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.applicants a
  WHERE a.id = applicant_stage_history.applicant_id
    AND (
      public.is_admin(auth.uid())
      OR a.assigned_recruiter_id = auth.uid()
      OR a.original_recruiter_id = auth.uid()
      OR public.is_descendant(auth.uid(), a.assigned_recruiter_id)
      OR public.is_descendant(auth.uid(), a.original_recruiter_id)
    )
));

-- Remove anonymous/public read access to system_settings so internal emails
-- and scheduling URLs are not exposed to the internet.
REVOKE SELECT ON public.system_settings FROM anon;
DROP POLICY IF EXISTS "public reads settings" ON public.system_settings;