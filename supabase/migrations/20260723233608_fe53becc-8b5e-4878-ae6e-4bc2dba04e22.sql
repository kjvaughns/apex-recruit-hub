
-- Extend existing resources
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'guide',
  ADD COLUMN IF NOT EXISTS long text,
  ADD COLUMN IF NOT EXISTS cta text,
  ADD COLUMN IF NOT EXISTS meta text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS display_date date;

-- Presenters
CREATE TABLE public.presenters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT,
  initials TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presenters TO authenticated;
GRANT ALL ON public.presenters TO service_role;
ALTER TABLE public.presenters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presenters_select_auth" ON public.presenters FOR SELECT TO authenticated USING (is_active OR public.is_admin(auth.uid()));
CREATE POLICY "presenters_admin_write" ON public.presenters FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER presenters_touch BEFORE UPDATE ON public.presenters FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Recordings
CREATE TABLE public.recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  presenter_id UUID NOT NULL REFERENCES public.presenters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  topic TEXT,
  description TEXT,
  video_url TEXT,
  audio BOOLEAN NOT NULL DEFAULT false,
  duration TEXT,
  recorded_on DATE,
  position INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recordings TO authenticated;
GRANT ALL ON public.recordings TO service_role;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recordings_select_auth" ON public.recordings FOR SELECT TO authenticated USING (is_published OR public.is_admin(auth.uid()));
CREATE POLICY "recordings_admin_write" ON public.recordings FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER recordings_touch BEFORE UPDATE ON public.recordings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Quick links
CREATE TABLE public.quick_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  label TEXT NOT NULL,
  sub TEXT,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_links TO authenticated;
GRANT ALL ON public.quick_links TO service_role;
ALTER TABLE public.quick_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quick_links_select_auth" ON public.quick_links FOR SELECT TO authenticated USING (is_active OR public.is_admin(auth.uid()));
CREATE POLICY "quick_links_admin_write" ON public.quick_links FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER quick_links_touch BEFORE UPDATE ON public.quick_links FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Reset seed resources to match design bundle
DELETE FROM public.resources;

INSERT INTO public.resources (title, description, long, category, type, url, cta, meta, tags, display_date, position, is_published, kind) VALUES
  ('APEX Agent Playbook',
   'The official APEX playbook — your start-to-finish guide to onboarding, daily activity, and the systems that drive production.',
   'The complete APEX Agent Playbook: how to get licensed and contracted, set up your tools, run your day, and follow the proven systems that turn new agents into consistent producers. Keep this open in your first 90 days and revisit it often.',
   'onboarding', 'pdf',
   '/__l5e/assets-v1/8aea8e43-89bc-4763-88d5-7b8113aed672/APEX_Agent_Playbook.pdf',
   'Open PDF', 'PDF',
   ARRAY['playbook','onboarding','getting started','systems','guide'],
   DATE '2026-05-28', 1, true, 'doc'),
  ('Needs Analysis Quiz',
   'A quick client needs-analysis quiz to uncover the real coverage gap before you present.',
   'Use this needs-analysis quiz on every appointment to surface income, debt, final-expense, and dependent needs in minutes — so the right coverage amount becomes obvious to the client.',
   'sales tools', 'pdf',
   '/__l5e/assets-v1/469d8440-ad57-43b9-b0df-4cd1489357ab/Needs_Analysis_Quiz.pdf',
   'Open PDF', 'PDF',
   ARRAY['needs analysis','quiz','discovery','fact finding','worksheet'],
   DATE '2026-05-28', 2, true, 'doc'),
  ('Apex Script 3.0 — Senior Benefits',
   'The current Senior State Benefits / life insurance phone script — intro through the close.',
   'The latest version of the APEX phone script for senior benefits and life insurance prospects. Covers the verification intro, qualifying questions, and the transition to the presentation. Internalize this before you dial.',
   'scripts', 'guide',
   'https://docs.google.com/document/d/1hgA1vKf0Bo0kgQ2nf45bN8tfdLwQMwkWyTbakAjZUKw/edit?usp=sharing',
   'Open Script', 'Script · Google Doc',
   ARRAY['script','phone','senior benefits','life insurance','sales'],
   DATE '2026-05-26', 3, true, 'link'),
  ('Apex Script — Veterans (VA Benefits)',
   'The veteran burial-coverage opener and full call flow for VA-benefit prospects.',
   'The APEX phone script for the veterans market — the benefits-coordinator opener, how to verify existing burial coverage, and the path to a needs analysis. Pairs with the senior benefits script.',
   'scripts', 'guide',
   'https://docs.google.com/document/d/1OeDu_6TABfIJtVHrn1TrJUjWGzgehYttoMj7ttSebxI/edit?usp=sharing',
   'Open Script', 'Script · Google Doc',
   ARRAY['script','phone','veterans','final expense','sales'],
   DATE '2026-05-24', 4, true, 'link');

INSERT INTO public.presenters (slug, name, role, initials, sort_order) VALUES
  ('kj',    'KJ',    'Regional Director', 'KJ', 1),
  ('obi',   'Obi',   'Senior Producer',   'O',  2),
  ('chudi', 'Chudi', 'Field Trainer',     'C',  3),
  ('sam',   'Sam',   'Agency Owner',      'S',  4),
  ('moody', 'Moody', 'Top Producer',      'M',  5);

INSERT INTO public.recordings (presenter_id, title, topic, description, video_url, audio, duration, recorded_on, position)
SELECT p.id, t.title, t.topic, t.description, t.video_url, t.audio, t.duration, t.recorded_on, t.position
FROM (VALUES
  ('kj','Beating the Price Objection — Version 1','Objections',
   'One version of KJ''s price-objection pitch — how he reframes "it costs too much" around the value of the protection.',
   'https://drive.google.com/file/d/1aNpO39ZqQ3veCp1m4Aya8pa0QQ4Ffzjj/preview', true, '18:20', DATE '2026-05-21', 1),
  ('kj','Beating the Price Objection — Version 2','Objections',
   'A different take on the same price-objection pitch — another way KJ holds the price and moves toward the close.',
   'https://drive.google.com/file/d/1Pu3KtI7zg5Bp0uvvHnIhWq7675Kt0Ts6/preview', true, '15:40', DATE '2026-05-07', 2),
  ('kj','Selling More Coverage — Objection Handling','Objections',
   'Handling objections when positioning additional coverage so clients land on the right level of protection.',
   'https://drive.google.com/file/d/1F4QK3vqzTO0R30SKp92KRuDNKhRQf1qj/preview', true, '22:10', DATE '2026-04-12', 3)
) AS t(pslug, title, topic, description, video_url, audio, duration, recorded_on, position)
JOIN public.presenters p ON p.slug = t.pslug;

INSERT INTO public.quick_links (label, sub, url, position) VALUES
  ('InsuraCloud', 'Quoting & e-apps',        '#', 1),
  ('Readymode',   'Power dialer',            '#', 2),
  ('AgentLink',   'Contracting & comp',      '#', 3),
  ('Website',     'apexfinancialempire.com', '#', 4);
