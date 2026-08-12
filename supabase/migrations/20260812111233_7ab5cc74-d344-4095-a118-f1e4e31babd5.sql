DROP POLICY IF EXISTS "staff read action tokens" ON public.applicant_action_tokens;
CREATE POLICY "admins and assigned recruiters read action tokens"
ON public.applicant_action_tokens FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.applicants a
    WHERE a.id = applicant_action_tokens.applicant_id
      AND (
        a.assigned_recruiter_id = auth.uid()
        OR a.original_recruiter_id = auth.uid()
        OR public.is_descendant(auth.uid(), a.assigned_recruiter_id)
        OR public.is_descendant(auth.uid(), a.original_recruiter_id)
      )
  )
);