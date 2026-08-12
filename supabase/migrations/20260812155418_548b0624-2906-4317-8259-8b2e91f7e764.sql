CREATE OR REPLACE FUNCTION public.can_invite_role(_inviter uuid, _role text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r text := public.get_primary_role(_inviter);
  inv_leaders boolean;
BEGIN
  IF _inviter IS NULL OR r IS NULL THEN RETURN false; END IF;
  IF _role = 'super_admin' THEN RETURN false; END IF;
  IF r IN ('admin','super_admin') THEN RETURN true; END IF;
  IF r = 'manager' THEN RETURN _role IN ('leader','agent'); END IF;
  IF _role = 'agent' THEN RETURN true; END IF;
  IF _role = 'leader' AND r = 'leader' THEN
    SELECT can_invite_leaders INTO inv_leaders FROM public.profiles WHERE id = _inviter;
    RETURN coalesce(inv_leaders, false);
  END IF;
  RETURN false;
END;
$$;