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
