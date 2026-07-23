
-- =========================================================================
-- APEX Financial — Phase 1 schema
-- =========================================================================

-- ---- Roles ---------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('agent', 'manager', 'admin', 'super_admin');

-- ---- Teams ---------------------------------------------------------------
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- ---- Profiles ------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  full_name text GENERATED ALWAYS AS (trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))) STORED,
  email text,
  phone text,
  avatar_url text,
  recruiting_slug text UNIQUE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profiles_slug_lower_idx ON public.profiles (lower(recruiting_slug));
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ---- User roles ----------------------------------------------------------
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','super_admin')
  )
$$;

-- ---- Applicant sources ---------------------------------------------------
CREATE TABLE public.applicant_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicant_sources TO authenticated;
GRANT ALL ON public.applicant_sources TO service_role;
ALTER TABLE public.applicant_sources ENABLE ROW LEVEL SECURITY;

INSERT INTO public.applicant_sources (slug, label) VALUES
  ('referral', 'Recruiter referral link'),
  ('direct', 'Direct — public site'),
  ('unknown', 'Unknown');

-- ---- Pipeline stages -----------------------------------------------------
CREATE TABLE public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  position int NOT NULL,
  color text NOT NULL DEFAULT '#C9A84C',
  is_completed_stage boolean NOT NULL DEFAULT false,
  is_lost_stage boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_stages TO authenticated;
GRANT ALL ON public.pipeline_stages TO service_role;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

INSERT INTO public.pipeline_stages (slug, name, position, color, is_completed_stage, is_lost_stage) VALUES
  ('new-applicant',       'New Applicant',       10, '#6FB1E0', false, false),
  ('attempting-contact',  'Attempting Contact',  20, '#8C8A84', false, false),
  ('contacted',           'Contacted',           30, '#9AB4D6', false, false),
  ('interview-scheduled', 'Interview Scheduled', 40, '#C9A84C', false, false),
  ('interview-completed', 'Interview Completed', 50, '#DDBB6A', false, false),
  ('licensing',           'Licensing',           60, '#E0A05A', false, false),
  ('pre-contracting',     'Pre-Contracting',     70, '#F3DD94', false, false),
  ('contracting',         'Contracting',         80, '#F3DD94', false, false),
  ('training',            'Training',            90, '#B7E0B7', false, false),
  ('active-agent',        'Active Agent',       100, '#5FCF8A', true,  false),
  ('not-moving-forward',  'Not Moving Forward', 110, '#8A5A5A', false, true);

-- ---- Applicants ----------------------------------------------------------
CREATE TABLE public.applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  date_of_birth date,
  address text,
  city text,
  state text,
  zip text,

  licensed boolean NOT NULL DEFAULT false,
  licensing_status text,

  why_text text,
  consent_contact boolean NOT NULL DEFAULT true,

  source_id uuid REFERENCES public.applicant_sources(id) ON DELETE SET NULL,
  source_details text,
  ref_slug text,

  original_recruiter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_recruiter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,

  current_stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  stage_entered_at timestamptz NOT NULL DEFAULT now(),

  priority text NOT NULL DEFAULT 'normal',
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  calendly_scheduled_at timestamptz,
  evaluation_completed_at timestamptz,

  status text NOT NULL DEFAULT 'active',
  archived_at timestamptz
);
CREATE INDEX applicants_email_lower_idx      ON public.applicants (lower(email));
CREATE INDEX applicants_assigned_idx         ON public.applicants (assigned_recruiter_id);
CREATE INDEX applicants_original_idx         ON public.applicants (original_recruiter_id);
CREATE INDEX applicants_stage_idx            ON public.applicants (current_stage_id);
CREATE INDEX applicants_created_at_idx       ON public.applicants (created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicants TO authenticated;
GRANT ALL ON public.applicants TO service_role;
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;

-- ---- Applicant activity timeline -----------------------------------------
CREATE TABLE public.applicant_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  summary text,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX applicant_activities_applicant_idx ON public.applicant_activities (applicant_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicant_activities TO authenticated;
GRANT ALL ON public.applicant_activities TO service_role;
ALTER TABLE public.applicant_activities ENABLE ROW LEVEL SECURITY;

-- ---- Evaluations ---------------------------------------------------------
CREATE TABLE public.evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  applicant_id uuid REFERENCES public.applicants(id) ON DELETE SET NULL,
  email text NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  matched boolean NOT NULL DEFAULT false
);
CREATE INDEX evaluations_email_lower_idx ON public.evaluations (lower(email));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluations TO authenticated;
GRANT ALL ON public.evaluations TO service_role;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- ---- System settings -----------------------------------------------------
CREATE TABLE public.system_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
GRANT SELECT ON public.system_settings TO anon;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.system_settings (key, value) VALUES
  ('calendly_url', 'https://calendly.com/apex-financial/overview'),
  ('email_sender_name', 'APEX Financial Hiring'),
  ('email_reply_to', 'kjvaughns13@gmail.com')
ON CONFLICT (key) DO NOTHING;

-- =========================================================================
-- RLS POLICIES
-- =========================================================================

-- teams
CREATE POLICY "staff read teams" ON public.teams
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admins manage teams" ON public.teams
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- profiles
CREATE POLICY "staff read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "user updates self profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "admins manage profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- user_roles
CREATE POLICY "user reads own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "super admin manages roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- applicant_sources
CREATE POLICY "staff read sources" ON public.applicant_sources
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admins manage sources" ON public.applicant_sources
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- pipeline_stages
CREATE POLICY "staff read stages" ON public.pipeline_stages
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admins manage stages" ON public.pipeline_stages
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- applicants
CREATE POLICY "agent reads own applicants" ON public.applicants
  FOR SELECT TO authenticated
  USING (assigned_recruiter_id = auth.uid() OR original_recruiter_id = auth.uid());
CREATE POLICY "manager reads team applicants" ON public.applicants
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager') AND team_id IN (
      SELECT team_id FROM public.profiles WHERE id = auth.uid() AND team_id IS NOT NULL
    )
  );
CREATE POLICY "admins read all applicants" ON public.applicants
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "assigned recruiter updates" ON public.applicants
  FOR UPDATE TO authenticated
  USING (assigned_recruiter_id = auth.uid())
  WITH CHECK (assigned_recruiter_id = auth.uid());
CREATE POLICY "admins manage applicants" ON public.applicants
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- applicant_activities
CREATE POLICY "staff reads activities for readable applicants" ON public.applicant_activities
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.applicants a WHERE a.id = applicant_id)
  );
CREATE POLICY "staff inserts activities" ON public.applicant_activities
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- evaluations
CREATE POLICY "staff reads evaluations" ON public.evaluations
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admins manage evaluations" ON public.evaluations
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- system_settings
CREATE POLICY "public reads settings" ON public.system_settings
  FOR SELECT TO anon USING (true);
CREATE POLICY "staff reads settings" ON public.system_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage settings" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================================
-- PUBLIC INTAKE RPCs (SECURITY DEFINER)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.submit_application(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text := trim(coalesce(payload->>'first_name',''));
  v_last  text := trim(coalesce(payload->>'last_name',''));
  v_email text := lower(trim(coalesce(payload->>'email','')));
  v_phone text := trim(coalesce(payload->>'phone',''));
  v_ref_slug text := lower(trim(coalesce(payload->>'ref_slug','')));
  v_stage_id uuid;
  v_source_id uuid;
  v_recruiter_id uuid;
  v_team_id uuid;
  v_id uuid;
BEGIN
  IF v_first = '' OR v_last = '' OR v_email = '' OR v_phone = '' THEN
    RAISE EXCEPTION 'Missing required fields';
  END IF;

  SELECT id INTO v_stage_id FROM public.pipeline_stages WHERE slug = 'new-applicant';

  IF v_ref_slug <> '' THEN
    SELECT id, team_id INTO v_recruiter_id, v_team_id
      FROM public.profiles
      WHERE lower(recruiting_slug) = v_ref_slug AND is_active = true;
  END IF;

  IF v_recruiter_id IS NOT NULL THEN
    SELECT id INTO v_source_id FROM public.applicant_sources WHERE slug = 'referral';
  ELSE
    SELECT id INTO v_source_id FROM public.applicant_sources WHERE slug = 'direct';
  END IF;

  INSERT INTO public.applicants (
    first_name, last_name, email, phone,
    date_of_birth, address, city, state, zip,
    licensed, why_text, consent_contact,
    source_id, ref_slug,
    original_recruiter_id, assigned_recruiter_id, team_id,
    current_stage_id, stage_entered_at
  ) VALUES (
    v_first, v_last, v_email, v_phone,
    nullif(payload->>'date_of_birth','')::date,
    nullif(payload->>'address',''),
    nullif(payload->>'city',''),
    nullif(payload->>'state',''),
    nullif(payload->>'zip',''),
    coalesce((payload->>'licensed')::boolean, false),
    nullif(payload->>'why_text',''),
    coalesce((payload->>'consent_contact')::boolean, true),
    v_source_id,
    nullif(v_ref_slug,''),
    v_recruiter_id, v_recruiter_id, v_team_id,
    v_stage_id, now()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.applicant_activities (applicant_id, event_type, summary, data)
  VALUES (v_id, 'application_submitted', 'Application submitted from public site',
          jsonb_build_object('ref_slug', v_ref_slug, 'recruiter_id', v_recruiter_id));

  RETURN jsonb_build_object('id', v_id, 'recruiter_id', v_recruiter_id);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_application(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_application(jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_evaluation(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(payload->>'email','')));
  v_answers jsonb := coalesce(payload->'answers', '{}'::jsonb);
  v_applicant_id uuid;
  v_eval_id uuid;
BEGIN
  IF v_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  SELECT id INTO v_applicant_id
    FROM public.applicants
    WHERE lower(email) = v_email
    ORDER BY created_at DESC
    LIMIT 1;

  INSERT INTO public.evaluations (email, answers, applicant_id, matched)
  VALUES (v_email, v_answers, v_applicant_id, v_applicant_id IS NOT NULL)
  RETURNING id INTO v_eval_id;

  IF v_applicant_id IS NOT NULL THEN
    UPDATE public.applicants
      SET evaluation_completed_at = now(),
          updated_at = now()
      WHERE id = v_applicant_id;

    INSERT INTO public.applicant_activities (applicant_id, event_type, summary, data)
    VALUES (v_applicant_id, 'evaluation_submitted', 'Evaluation submitted', v_answers);
  END IF;

  RETURN jsonb_build_object('id', v_eval_id, 'matched', v_applicant_id IS NOT NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_evaluation(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_evaluation(jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_applicant_scheduled(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(_email,'')));
  v_id uuid;
  v_stage uuid;
BEGIN
  IF v_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  SELECT id INTO v_id FROM public.applicants
    WHERE lower(email) = v_email
    ORDER BY created_at DESC LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  SELECT id INTO v_stage FROM public.pipeline_stages WHERE slug = 'interview-scheduled';

  UPDATE public.applicants
    SET calendly_scheduled_at = now(),
        current_stage_id = v_stage,
        stage_entered_at = now(),
        updated_at = now()
    WHERE id = v_id;

  INSERT INTO public.applicant_activities (applicant_id, event_type, summary)
  VALUES (v_id, 'appointment_scheduled', 'Overview call scheduled via Calendly');

  RETURN jsonb_build_object('matched', true, 'id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.mark_applicant_scheduled(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_applicant_scheduled(text) TO anon, authenticated, service_role;

-- =========================================================================
-- Profile auto-provisioning on new auth users
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data->>'first_name', ''),
    coalesce(NEW.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER applicants_touch BEFORE UPDATE ON public.applicants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
