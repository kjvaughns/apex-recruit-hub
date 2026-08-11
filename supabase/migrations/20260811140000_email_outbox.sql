-- Phase 3 — Email templates + wired triggers (no provider yet).
--
-- We don't send email in this pass. Instead every trigger point enqueues a
-- fully-rendered ("stub") email into an outbox as status='pending'. When a
-- transactional provider is wired up later, it drains pending rows and flips
-- them to 'sent'. This makes the trigger wiring real and inspectable today
-- without anything actually leaving the building.

CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  to_email text NOT NULL,
  to_name text,
  subject text NOT NULL,
  html text NOT NULL,
  template_key text NOT NULL,
  applicant_id uuid REFERENCES public.applicants(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',   -- pending | sent | failed | skipped
  sent_at timestamptz,
  error text
);
CREATE INDEX IF NOT EXISTS email_outbox_status_idx ON public.email_outbox (status, created_at);
CREATE INDEX IF NOT EXISTS email_outbox_applicant_idx ON public.email_outbox (applicant_id);

GRANT SELECT, INSERT, UPDATE ON public.email_outbox TO authenticated;
GRANT ALL ON public.email_outbox TO service_role;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

-- Only staff can read the outbox; writes go exclusively through enqueue_email.
DROP POLICY IF EXISTS email_outbox_select ON public.email_outbox;
CREATE POLICY email_outbox_select ON public.email_outbox
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','super_admin','manager')
    )
  );

-- SECURITY DEFINER enqueue so both the public application flow (anon) and the
-- authenticated portal can queue email without a direct INSERT grant/policy.
CREATE OR REPLACE FUNCTION public.enqueue_email(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_to text := lower(trim(coalesce(payload->>'to_email','')));
BEGIN
  IF v_to = '' THEN
    RAISE EXCEPTION 'to_email is required';
  END IF;
  INSERT INTO public.email_outbox (to_email, to_name, subject, html, template_key, applicant_id)
  VALUES (
    v_to,
    nullif(payload->>'to_name',''),
    coalesce(payload->>'subject',''),
    coalesce(payload->>'html',''),
    coalesce(payload->>'template_key','unknown'),
    nullif(payload->>'applicant_id','')::uuid
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_email(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email(jsonb) TO anon, authenticated, service_role;
