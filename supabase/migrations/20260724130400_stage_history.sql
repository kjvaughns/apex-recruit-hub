-- =========================================================================
-- APEX Portal — Applicant stage history (Phase 4)
-- Every stage entry (initial + each move) is recorded automatically.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.applicant_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  entered_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stage_history_applicant_idx
  ON public.applicant_stage_history (applicant_id, entered_at DESC);
GRANT SELECT, INSERT ON public.applicant_stage_history TO authenticated;
GRANT ALL ON public.applicant_stage_history TO service_role;
ALTER TABLE public.applicant_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read stage history" ON public.applicant_stage_history
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_stage_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
END;
$$;

DROP TRIGGER IF EXISTS applicants_stage_history ON public.applicants;
CREATE TRIGGER applicants_stage_history
  AFTER INSERT OR UPDATE OF current_stage_id ON public.applicants
  FOR EACH ROW EXECUTE FUNCTION public.log_stage_history();
