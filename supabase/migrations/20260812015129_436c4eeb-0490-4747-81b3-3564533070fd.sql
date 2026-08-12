CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins (and server-side/service_role work) may change privilege columns.
  IF auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin')
     OR public.has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;

  -- Everyone else keeps their existing privilege-related values.
  NEW.can_manage_resources := OLD.can_manage_resources;
  NEW.can_invite_agents    := OLD.can_invite_agents;
  NEW.can_invite_leaders   := OLD.can_invite_leaders;
  NEW.can_receive_applicants := OLD.can_receive_applicants;
  NEW.can_schedule_licensed  := OLD.can_schedule_licensed;
  NEW.licensed  := OLD.licensed;
  NEW.is_active := OLD.is_active;
  NEW.parent_user_id := OLD.parent_user_id;
  NEW.team_id := OLD.team_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();