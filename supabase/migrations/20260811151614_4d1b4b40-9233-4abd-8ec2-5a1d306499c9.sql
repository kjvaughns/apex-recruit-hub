DROP POLICY IF EXISTS "staff reads evaluations" ON public.evaluations;

CREATE POLICY "recruiters read their applicant evaluations"
ON public.evaluations FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.applicants a
    WHERE a.id = evaluations.applicant_id
      AND (
        a.assigned_recruiter_id = auth.uid()
        OR a.original_recruiter_id = auth.uid()
        OR is_descendant(auth.uid(), a.assigned_recruiter_id)
        OR is_descendant(auth.uid(), a.original_recruiter_id)
      )
  )
);