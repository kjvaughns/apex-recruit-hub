-- PR1: Recruiting data-model foundation.
--
-- Restructures the pipeline stages to the target recruiting flow and adds
-- npn / resident_state / recruiting_status to applicants (plus npn/resident_state
-- to profiles). No app UI changes: the stage-picker queries already filter
-- `is_archived = false`, so archiving a stage hides it everywhere automatically.
--
-- Note: the `contracting` stage is intentionally KEPT active here because the
-- evaluation auto-hire RPC still targets it; a later PR repoints that RPC to
-- `interview-completed` and archives `contracting` at the same time.

-- 1. Pipeline stages ---------------------------------------------------------

-- Add the two new stages (idempotent on the unique slug).
INSERT INTO public.pipeline_stages (slug, name, position, color, is_completed_stage, is_lost_stage)
VALUES
  ('pre-licensing', 'Pre Licensing', 40, '#E0A05A', false, false),
  ('state-exam',    'State Exam',    50, '#D98F6A', false, false)
ON CONFLICT (slug) DO NOTHING;

-- Rename + reposition the kept stages into the target order.
UPDATE public.pipeline_stages SET name = 'New Applicant',       position = 10  WHERE slug = 'new-applicant';
UPDATE public.pipeline_stages SET name = 'Interview Scheduled', position = 20  WHERE slug = 'interview-scheduled';
UPDATE public.pipeline_stages SET name = 'Interview Completed', position = 30  WHERE slug = 'interview-completed';
UPDATE public.pipeline_stages SET name = 'Pre Licensing',       position = 40  WHERE slug = 'pre-licensing';
UPDATE public.pipeline_stages SET name = 'State Exam',          position = 50  WHERE slug = 'state-exam';
UPDATE public.pipeline_stages SET name = 'Licensing',           position = 60  WHERE slug = 'licensing';
UPDATE public.pipeline_stages SET name = 'Contracting',         position = 70  WHERE slug = 'contracting';
UPDATE public.pipeline_stages SET name = 'Onboarding',          position = 80  WHERE slug = 'onboarding';
UPDATE public.pipeline_stages SET name = 'Training',            position = 90  WHERE slug = 'training';
UPDATE public.pipeline_stages SET name = 'Active',              position = 100 WHERE slug = 'active-agent';
UPDATE public.pipeline_stages SET name = 'Terminated',          position = 110 WHERE slug = 'not-moving-forward';

-- Remap applicants off the merged-away stages, then archive those stages.
UPDATE public.applicants
  SET current_stage_id = (SELECT id FROM public.pipeline_stages WHERE slug = 'new-applicant')
  WHERE current_stage_id IN (
    SELECT id FROM public.pipeline_stages WHERE slug IN ('attempting-contact', 'contacted')
  );
UPDATE public.applicants
  SET current_stage_id = (SELECT id FROM public.pipeline_stages WHERE slug = 'licensing')
  WHERE current_stage_id IN (
    SELECT id FROM public.pipeline_stages WHERE slug = 'pre-contracting'
  );
UPDATE public.pipeline_stages
  SET is_archived = true
  WHERE slug IN ('attempting-contact', 'contacted', 'pre-contracting');

-- 2. Applicants columns ------------------------------------------------------

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS npn text,
  ADD COLUMN IF NOT EXISTS resident_state text,
  ADD COLUMN IF NOT EXISTS recruiting_status text NOT NULL DEFAULT 'pending';

COMMENT ON COLUMN public.applicants.recruiting_status IS
  'Recruiting decision/condition: pending, hired, follow_up, no_show, not_interested, not_qualified, declined, inactive, terminated. Independent of current_stage_id (pipeline position) and of the lifecycle status/archived_at columns.';

-- Seed resident_state from the legacy `state`; recruiting_status from signals.
UPDATE public.applicants
  SET resident_state = state
  WHERE resident_state IS NULL AND state IS NOT NULL AND state <> '';
UPDATE public.applicants
  SET recruiting_status = 'hired'
  WHERE recruiting_status = 'pending' AND hired_at IS NOT NULL;

-- 3. Profiles columns --------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS npn text,
  ADD COLUMN IF NOT EXISTS resident_state text;