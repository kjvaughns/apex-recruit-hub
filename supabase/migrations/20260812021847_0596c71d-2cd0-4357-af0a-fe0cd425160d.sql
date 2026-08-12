-- Extensions for scheduled campaign/reminder sweeps
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- 1. email_outbox -> full email log
-- ============================================================
ALTER TABLE public.email_outbox
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_name text,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'transactional',
  ADD COLUMN IF NOT EXISTS automated boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS campaign_slug text,
  ADD COLUMN IF NOT EXISTS cta_url text,
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS email_outbox_profile_idx ON public.email_outbox (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS email_outbox_template_idx ON public.email_outbox (template_name, created_at DESC);
CREATE INDEX IF NOT EXISTS email_outbox_to_idx ON public.email_outbox (to_email, created_at DESC);

DROP POLICY IF EXISTS email_outbox_select ON public.email_outbox;
CREATE POLICY email_outbox_select ON public.email_outbox
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'manager')
    OR profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.applicants a
      WHERE a.id = email_outbox.applicant_id
        AND (
          a.assigned_recruiter_id = auth.uid()
          OR a.original_recruiter_id = auth.uid()
          OR a.assigned_manager_id = auth.uid()
          OR public.is_descendant(auth.uid(), a.assigned_recruiter_id)
        )
    )
  );

GRANT SELECT ON public.email_outbox TO authenticated;
GRANT ALL ON public.email_outbox TO service_role;

-- ============================================================
-- 2. Admin template overrides
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL UNIQUE,
  subject_override text,
  body_override jsonb,
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_templates_read ON public.email_templates
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY email_templates_write ON public.email_templates
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER email_templates_touch BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 3. Campaigns + subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  audience text NOT NULL DEFAULT 'subscribers',
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  target_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  schedule_label text,
  cadence text NOT NULL DEFAULT 'manual',
  enabled boolean NOT NULL DEFAULT false,
  optional boolean NOT NULL DEFAULT true,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_sent_at timestamptz,
  next_send_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaigns TO authenticated;
GRANT ALL ON public.email_campaigns TO service_role;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_campaigns_read ON public.email_campaigns
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY email_campaigns_write ON public.email_campaigns
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER email_campaigns_touch BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.email_campaign_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_slug text NOT NULL,
  subscribed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, campaign_slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaign_subscriptions TO authenticated;
GRANT ALL ON public.email_campaign_subscriptions TO service_role;
ALTER TABLE public.email_campaign_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_subs_own ON public.email_campaign_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER email_subs_touch BEFORE UPDATE ON public.email_campaign_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 4. Duplicate protection
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_send_keys (
  send_key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_send_keys TO authenticated;
GRANT ALL ON public.email_send_keys TO service_role;
ALTER TABLE public.email_send_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_send_keys_read ON public.email_send_keys
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Claims a send key. Returns true only the first time for a given key.
CREATE OR REPLACE FUNCTION public.email_claim_send(_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _key IS NULL OR length(trim(_key)) = 0 THEN
    RETURN true;
  END IF;
  INSERT INTO public.email_send_keys (send_key) VALUES (trim(_key));
  RETURN true;
EXCEPTION WHEN unique_violation THEN
  RETURN false;
END;
$$;

-- ============================================================
-- 5. Extended email log writer
-- ============================================================
CREATE OR REPLACE FUNCTION public.enqueue_email(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_to text := lower(trim(coalesce(payload->>'to_email','')));
  v_status text := lower(coalesce(nullif(payload->>'status',''), 'queued'));
BEGIN
  IF v_to = '' THEN
    RAISE EXCEPTION 'to_email is required';
  END IF;
  IF v_status NOT IN ('queued','pending','sent','delivered','failed','bounced','complained','suppressed','skipped') THEN
    v_status := 'queued';
  END IF;
  INSERT INTO public.email_outbox (
    to_email, to_name, subject, html, template_key, template_name, applicant_id,
    profile_id, category, automated, sent_by, provider_message_id, campaign_slug,
    cta_url, meta, status, sent_at, error
  ) VALUES (
    v_to,
    nullif(payload->>'to_name',''),
    coalesce(payload->>'subject',''),
    coalesce(payload->>'html',''),
    coalesce(payload->>'template_key', payload->>'template_name', 'unknown'),
    nullif(payload->>'template_name',''),
    nullif(payload->>'applicant_id','')::uuid,
    nullif(payload->>'profile_id','')::uuid,
    coalesce(nullif(payload->>'category',''), 'transactional'),
    coalesce((payload->>'automated')::boolean, true),
    nullif(payload->>'sent_by','')::uuid,
    nullif(payload->>'provider_message_id',''),
    nullif(payload->>'campaign_slug',''),
    nullif(payload->>'cta_url',''),
    coalesce(payload->'meta', '{}'::jsonb),
    v_status,
    CASE WHEN v_status IN ('sent','delivered') THEN now() ELSE NULL END,
    nullif(payload->>'error','')
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ============================================================
-- 6. Notification preference defaults
-- ============================================================
ALTER TABLE public.profiles
  ALTER COLUMN notification_prefs SET DEFAULT jsonb_build_object(
    'email_enabled', true,
    'recruiting_updates', true,
    'applicant_follow_ups', true,
    'training_reminders', true,
    'meeting_reminders', true,
    'agency_announcements', true,
    'onboarding_updates', true
  );

UPDATE public.profiles
   SET notification_prefs = coalesce(notification_prefs, '{}'::jsonb) || jsonb_build_object(
        'email_enabled', coalesce((notification_prefs->>'email_enabled')::boolean, true),
        'recruiting_updates', coalesce((notification_prefs->>'recruiting_updates')::boolean, true),
        'applicant_follow_ups', coalesce((notification_prefs->>'applicant_follow_ups')::boolean, true),
        'training_reminders', coalesce((notification_prefs->>'training_reminders')::boolean, true),
        'meeting_reminders', coalesce((notification_prefs->>'meeting_reminders')::boolean, true),
        'agency_announcements', coalesce((notification_prefs->>'agency_announcements')::boolean, true),
        'onboarding_updates', coalesce((notification_prefs->>'onboarding_updates')::boolean, true)
      );

-- ============================================================
-- 7. Seed the operational campaigns
-- ============================================================
INSERT INTO public.email_campaigns (slug, name, description, audience, cadence, schedule_label, optional, enabled, content)
VALUES
  ('daily-production-focus','Daily Production Focus','Short morning focus email for subscribed agents.','subscribers','daily','Every day, 7:00 AM CT', true, false,
    jsonb_build_object('target','20 dials before noon','dialHours','10:00 AM – 12:00 PM and 5:00 PM – 8:00 PM CT','mindset','Activity is the only thing you control. Control it.','focus','Slow down the needs analysis and let them talk.')),
  ('weekly-game-plan','Weekly Vantage Game Plan','Monday morning plan for the week ahead.','all_active','weekly','Mondays, 7:00 AM CT', true, false,
    jsonb_build_object('meetingTime','Monday 7:00 PM CT','trainingTime','Wednesday 7:00 PM CT','filmReview','Thursday 7:00 PM CT','dialExpectation','300 dials per week','message','')),
  ('weekly-sales-tip','Weekly Sales Tip','One sales lesson per week with a link to the Academy.','subscribers','weekly','Fridays, 7:00 AM CT', true, false,
    jsonb_build_object('title','Tonality','body','Your tone sells before your words do. Mirror their pace, drop your pitch on price.','lessonSlug','')),
  ('academy-new-content','New Academy Content','Notify subscribed agents when new Academy content ships.','subscribers','manual','When new content is published', true, false, '{}'::jsonb),
  ('leadership-development','Leadership Development','Leadership-focused notes for managers and leaders.','leadership','weekly','Mondays, 7:00 AM CT', true, false, '{}'::jsonb)
ON CONFLICT (slug) DO NOTHING;