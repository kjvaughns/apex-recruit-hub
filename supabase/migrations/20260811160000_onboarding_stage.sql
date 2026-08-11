-- Onboarding Module — Phase 1: stage + data model + init trigger.
--
-- New "Onboarding" pipeline stage sits between Contracting (80) and Training
-- (90) at position 85, so no existing positions need shifting. Each applicant
-- that lands on this stage gets an onboarding_steps jsonb record with the 4
-- canonical steps; the branded welcome email is enqueued from the TS layer.

INSERT INTO public.pipeline_stages (slug, name, position, color, is_completed_stage, is_lost_stage)
VALUES ('onboarding', 'Onboarding', 85, '#7FC8A9', false, false)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS onboarding_steps jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

COMMENT ON COLUMN public.applicants.onboarding_steps IS
  'Per-step onboarding progress {step: {completed, completed_at}} for the 4 canonical steps.';
COMMENT ON COLUMN public.applicants.onboarding_completed_at IS
  'When all 4 onboarding steps first completed. Guards the "Onboarding Complete" email.';

-- Canonical fresh steps (all false; portal_account_setup flips true on first login).
CREATE OR REPLACE FUNCTION public.default_onboarding_steps()
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'agentspace_contracting', jsonb_build_object('completed', false, 'completed_at', null),
    'discord_role_update',    jsonb_build_object('completed', false, 'completed_at', null),
    'portal_account_setup',   jsonb_build_object('completed', false, 'completed_at', null),
    'expectations_reviewed',  jsonb_build_object('completed', false, 'completed_at', null)
  );
$$;

-- Initialize onboarding_steps the moment an applicant lands on the Onboarding
-- stage (on insert or when the stage changes to it), if not already set.
CREATE OR REPLACE FUNCTION public.applicants_init_onboarding()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_onboarding_id uuid;
BEGIN
  SELECT id INTO v_onboarding_id FROM public.pipeline_stages WHERE slug = 'onboarding';
  IF v_onboarding_id IS NOT NULL
     AND NEW.current_stage_id = v_onboarding_id
     AND (NEW.onboarding_steps IS NULL OR NEW.onboarding_steps = '{}'::jsonb) THEN
    NEW.onboarding_steps := public.default_onboarding_steps();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applicants_init_onboarding_trg ON public.applicants;
CREATE TRIGGER applicants_init_onboarding_trg
  BEFORE INSERT OR UPDATE OF current_stage_id ON public.applicants
  FOR EACH ROW EXECUTE FUNCTION public.applicants_init_onboarding();
