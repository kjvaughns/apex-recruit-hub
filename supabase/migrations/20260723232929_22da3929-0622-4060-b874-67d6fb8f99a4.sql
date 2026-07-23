
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  notes TEXT,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  applicant_id UUID REFERENCES public.applicants(id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select_own_or_admin" ON public.tasks FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "tasks_insert_auth" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "tasks_update_own_or_admin" ON public.tasks FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "tasks_delete_own_or_admin" ON public.tasks FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE TRIGGER tasks_touch BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  url TEXT,
  body TEXT,
  kind TEXT NOT NULL DEFAULT 'link',
  position INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resources TO authenticated;
GRANT ALL ON public.resources TO service_role;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resources_select_auth" ON public.resources FOR SELECT TO authenticated USING (is_published OR public.is_admin(auth.uid()));
CREATE POLICY "resources_admin_write" ON public.resources FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER resources_touch BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.resources (title, description, category, url, kind, position) VALUES
  ('Getting Started Guide', 'Your first 30 days at APEX Financial.', 'onboarding', 'https://apexfinancial.com/guide', 'link', 1),
  ('Life Insurance 101', 'Fundamentals of IUL, term, and whole life.', 'training', 'https://apexfinancial.com/training/life-101', 'link', 2),
  ('Compliance Handbook', 'State licensing requirements and best practices.', 'compliance', 'https://apexfinancial.com/compliance', 'link', 3),
  ('Recruiting Playbook', 'How to run a successful recruiting call.', 'recruiting', 'https://apexfinancial.com/recruiting-playbook', 'link', 4);
