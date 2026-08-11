DROP POLICY IF EXISTS "staff reads activities for readable applicants" ON public.applicant_activities;
CREATE POLICY "staff reads activities for readable applicants"
ON public.applicant_activities FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.applicants a
  WHERE a.id = applicant_activities.applicant_id
    AND (
      public.is_admin(auth.uid())
      OR a.assigned_recruiter_id = auth.uid()
      OR a.original_recruiter_id = auth.uid()
      OR public.is_descendant(auth.uid(), a.assigned_recruiter_id)
      OR public.is_descendant(auth.uid(), a.original_recruiter_id)
    )
));