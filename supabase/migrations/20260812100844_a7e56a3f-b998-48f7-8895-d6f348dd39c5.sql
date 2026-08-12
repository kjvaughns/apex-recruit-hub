ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS exam_date timestamptz,
  ADD COLUMN IF NOT EXISTS exam_provider text,
  ADD COLUMN IF NOT EXISTS exam_notes text,
  ADD COLUMN IF NOT EXISTS exam_result text,
  ADD COLUMN IF NOT EXISTS exam_passed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pre_licensing_at timestamptz,
  ADD COLUMN IF NOT EXISTS course_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS licensing_at timestamptz,
  ADD COLUMN IF NOT EXISTS training_started_at timestamptz;

CREATE TABLE IF NOT EXISTS public.applicant_action_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  action text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.applicant_action_tokens TO service_role;
ALTER TABLE public.applicant_action_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read action tokens" ON public.applicant_action_tokens
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS applicant_action_tokens_applicant_idx
  ON public.applicant_action_tokens (applicant_id, action);

CREATE TABLE IF NOT EXISTS public.applicant_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  touch_count integer NOT NULL DEFAULT 0,
  anchor_at timestamptz,
  next_send_at timestamptz,
  stop_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (applicant_id, kind)
);

GRANT SELECT ON public.applicant_sequences TO authenticated;
GRANT ALL ON public.applicant_sequences TO service_role;
ALTER TABLE public.applicant_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read sequences" ON public.applicant_sequences
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS applicant_sequences_due_idx
  ON public.applicant_sequences (status, next_send_at);

CREATE TRIGGER applicant_sequences_touch
  BEFORE UPDATE ON public.applicant_sequences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();