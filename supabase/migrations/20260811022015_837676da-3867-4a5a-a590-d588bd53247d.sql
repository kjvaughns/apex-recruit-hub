-- Phase 1 — Manual "overview scheduled / completed" tracking.
--
-- The Calendly webhook already flips an applicant to the "Interview Scheduled"
-- stage and stamps calendly_scheduled_at when they book the Overview. But
-- recruiters sometimes book the Overview for an applicant outside Calendly, so
-- we add explicit, manually-togglable timestamps that are independent of the
-- Calendly flow. overview_completed_at is also the gate for sending the
-- evaluation form in Phase 2.

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS overview_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS overview_completed_at timestamptz;

COMMENT ON COLUMN public.applicants.overview_scheduled_at IS
  'When the Vantage overview meeting was marked scheduled (manual or via Calendly).';
COMMENT ON COLUMN public.applicants.overview_completed_at IS
  'When the Vantage overview meeting was marked completed. Gates the evaluation form.';
-- Phase 2 — Evaluation form → auto-hire.
--
-- After the Overview is completed, a recruiter sends the applicant a pre-filled
-- evaluation link (/evaluation?a=<applicant_id>). On submission we:
--   * match the submission to the existing applicant record (by id, or email),
--   * move them to a "hired — pending" stage: reuse the existing Licensing stage
--     for unlicensed hires and the Contracting stage for licensed hires,
--   * stamp hired_at (idempotent), and
--   * increment a persistent per-recruiter hires counter for the leaderboard.

-- Persistent hire counter for the attributed recruiter.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hires integer NOT NULL DEFAULT 0;

-- Mark when an applicant was auto-hired via the evaluation form.
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS hired_at timestamptz;

COMMENT ON COLUMN public.profiles.hires IS
  'Count of applicants auto-hired via the evaluation form, attributed to this recruiter.';
COMMENT ON COLUMN public.applicants.hired_at IS
  'When the applicant was auto-hired on evaluation submission. NULL until hired.';

-- ---- Prefill context for the evaluation form -----------------------------
-- Safe, minimal projection resolved by unguessable applicant UUID. Mirrors the
-- scheduling-context pattern: no recruiter PII, only what the form prefills.
CREATE OR REPLACE FUNCTION public.get_evaluation_prefill(_applicant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v applicants%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.applicants WHERE id = _applicant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  RETURN jsonb_build_object(
    'found', true,
    'first_name', v.first_name,
    'last_name', v.last_name,
    'email', v.email,
    'licensed', v.licensed,
    'licensing_status', v.licensing_status,
    'already_hired', v.hired_at IS NOT NULL
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_evaluation_prefill(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_evaluation_prefill(uuid) TO anon, authenticated, service_role;

-- ---- Evaluation submission with auto-hire ---------------------------------
CREATE OR REPLACE FUNCTION public.submit_evaluation(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_applicant_id uuid := nullif(payload->>'applicant_id','')::uuid;
  v_email text := lower(trim(coalesce(payload->>'email','')));
  v_answers jsonb := coalesce(payload->'answers', '{}'::jsonb);
  v_eval_id uuid;
  v_app applicants%ROWTYPE;
  v_target_slug text;
  v_stage_id uuid;
  v_recruiter uuid;
  v_hired boolean := false;
BEGIN
  IF v_applicant_id IS NULL AND v_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  -- Resolve the applicant: prefer the embedded id, fall back to newest email match.
  IF v_applicant_id IS NOT NULL THEN
    SELECT * INTO v_app FROM public.applicants WHERE id = v_applicant_id;
  ELSE
    SELECT * INTO v_app FROM public.applicants
      WHERE lower(email) = v_email
      ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_email = '' AND v_app.id IS NOT NULL THEN
    v_email := lower(v_app.email);
  END IF;

  INSERT INTO public.evaluations (email, answers, applicant_id, matched)
  VALUES (v_email, v_answers, v_app.id, v_app.id IS NOT NULL)
  RETURNING id INTO v_eval_id;

  IF v_app.id IS NOT NULL THEN
    -- Reuse existing pipeline stages: licensed hires -> Contracting,
    -- unlicensed hires -> Licensing (the "hired — pending" states).
    v_target_slug := CASE WHEN coalesce(v_app.licensed, false) THEN 'contracting' ELSE 'licensing' END;
    SELECT id INTO v_stage_id FROM public.pipeline_stages WHERE slug = v_target_slug;

    -- Idempotent hire: only stamp + count the first time.
    v_hired := v_app.hired_at IS NULL;

    UPDATE public.applicants
      SET evaluation_completed_at = now(),
          current_stage_id = coalesce(v_stage_id, current_stage_id),
          stage_entered_at = CASE WHEN v_stage_id IS NOT NULL THEN now() ELSE stage_entered_at END,
          hired_at = coalesce(hired_at, now()),
          updated_at = now()
      WHERE id = v_app.id;

    INSERT INTO public.applicant_activities (applicant_id, event_type, summary, data)
    VALUES (v_app.id, 'evaluation_submitted', 'Evaluation submitted — auto-hired', v_answers);

    IF v_hired THEN
      v_recruiter := coalesce(v_app.original_recruiter_id, v_app.assigned_recruiter_id, v_app.referred_by_profile_id);
      IF v_recruiter IS NOT NULL THEN
        UPDATE public.profiles SET hires = coalesce(hires,0) + 1 WHERE id = v_recruiter;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_eval_id,
    'matched', v_app.id IS NOT NULL,
    'hired', v_hired,
    'licensed', coalesce(v_app.licensed, false)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.submit_evaluation(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_evaluation(jsonb) TO anon, authenticated, service_role;
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
-- Phase 4 — CRM upgrades.
--
--  * last_follow_up_at powers the "Pre-Licensing Pipeline" sort (longest since
--    last follow-up first) and the Phase 5 weekly-follow-up tracker. It is set
--    whenever the "Send follow-up email" action runs.
--  * discord_confirmed is a manual flag for unlicensed hires — checked once a
--    recruiter has seen the applicant's course screenshot in Discord. No Discord
--    API integration in this pass.

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS last_follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS discord_confirmed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.applicants.last_follow_up_at IS
  'When the last pre-licensing follow-up was sent. Drives the weekly follow-up tracker.';
COMMENT ON COLUMN public.applicants.discord_confirmed IS
  'Manually set once an unlicensed hire has posted their course screenshot in Discord.';