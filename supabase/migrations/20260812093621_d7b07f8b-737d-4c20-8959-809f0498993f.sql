-- PR8: add a Hires count to the company leaderboard (applicants with hired_at).
-- Everything else matches the existing function.

DROP FUNCTION IF EXISTS public.company_leaderboard(jsonb);

CREATE OR REPLACE FUNCTION public.company_leaderboard(payload jsonb)
RETURNS TABLE(
  profile_id uuid,
  full_name text,
  avatar_url text,
  role text,
  team_name text,
  manager_name text,
  new_count int,
  contacted_count int,
  scheduled_count int,
  completed_count int,
  promoted_count int,
  hired_count int,
  conversion numeric,
  total numeric,
  prev_total numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metric text := coalesce(payload->>'metric', 'new_applicants');
  v_period text := coalesce(payload->>'period', 'month');
  v_role text := nullif(payload->>'role', '');
  v_team uuid := nullif(payload->>'team_id', '')::uuid;
  v_state text := nullif(payload->>'state', '');
  v_start timestamptz;
  v_prev_start timestamptz;
BEGIN
  v_start := CASE v_period
    WHEN 'today' THEN date_trunc('day', now())
    WHEN 'week' THEN date_trunc('week', now())
    WHEN 'month' THEN date_trunc('month', now())
    WHEN 'quarter' THEN date_trunc('quarter', now())
    WHEN 'year' THEN date_trunc('year', now())
    ELSE '-infinity'::timestamptz
  END;
  v_prev_start := CASE WHEN v_start = '-infinity'::timestamptz THEN '-infinity'::timestamptz
                       ELSE v_start - (now() - v_start) END;

  RETURN QUERY
  WITH cur AS (
    SELECT a.assigned_recruiter_id AS uid,
      count(*) FILTER (WHERE a.created_at >= v_start) AS new_c,
      count(*) FILTER (WHERE a.last_contacted_at >= v_start) AS cont_c,
      count(*) FILTER (WHERE a.calendly_scheduled_at >= v_start) AS sched_c,
      count(*) FILTER (WHERE a.evaluation_completed_at >= v_start) AS comp_c,
      count(*) FILTER (WHERE a.promoted_to_agent_at >= v_start) AS prom_c,
      count(*) FILTER (WHERE a.hired_at >= v_start) AS hired_c
    FROM public.applicants a
    WHERE a.assigned_recruiter_id IS NOT NULL
    GROUP BY a.assigned_recruiter_id
  ),
  prev AS (
    SELECT a.assigned_recruiter_id AS uid,
      count(*) FILTER (WHERE a.created_at >= v_prev_start AND a.created_at < v_start) AS new_p,
      count(*) FILTER (WHERE a.last_contacted_at >= v_prev_start AND a.last_contacted_at < v_start) AS cont_p,
      count(*) FILTER (WHERE a.calendly_scheduled_at >= v_prev_start AND a.calendly_scheduled_at < v_start) AS sched_p,
      count(*) FILTER (WHERE a.evaluation_completed_at >= v_prev_start AND a.evaluation_completed_at < v_start) AS comp_p,
      count(*) FILTER (WHERE a.promoted_to_agent_at >= v_prev_start AND a.promoted_to_agent_at < v_start) AS prom_p
    FROM public.applicants a
    WHERE a.assigned_recruiter_id IS NOT NULL
    GROUP BY a.assigned_recruiter_id
  )
  SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    public.get_primary_role(p.id) AS role,
    t.name AS team_name,
    mgr.full_name AS manager_name,
    coalesce(cur.new_c, 0)::int,
    coalesce(cur.cont_c, 0)::int,
    coalesce(cur.sched_c, 0)::int,
    coalesce(cur.comp_c, 0)::int,
    coalesce(cur.prom_c, 0)::int,
    coalesce(cur.hired_c, 0)::int,
    CASE WHEN coalesce(cur.new_c, 0) > 0
         THEN round(coalesce(cur.prom_c, 0)::numeric / cur.new_c, 3) ELSE 0 END AS conversion,
    (CASE v_metric
      WHEN 'contacted' THEN coalesce(cur.cont_c, 0)
      WHEN 'interviews_scheduled' THEN coalesce(cur.sched_c, 0)
      WHEN 'interviews_completed' THEN coalesce(cur.comp_c, 0)
      WHEN 'promoted' THEN coalesce(cur.prom_c, 0)
      ELSE coalesce(cur.new_c, 0)
    END)::numeric AS total,
    (CASE v_metric
      WHEN 'contacted' THEN coalesce(prev.cont_p, 0)
      WHEN 'interviews_scheduled' THEN coalesce(prev.sched_p, 0)
      WHEN 'interviews_completed' THEN coalesce(prev.comp_p, 0)
      WHEN 'promoted' THEN coalesce(prev.prom_p, 0)
      ELSE coalesce(prev.new_p, 0)
    END)::numeric AS prev_total
  FROM public.profiles p
  LEFT JOIN cur ON cur.uid = p.id
  LEFT JOIN prev ON prev.uid = p.id
  LEFT JOIN public.teams t ON t.id = p.team_id
  LEFT JOIN public.profiles mgr ON mgr.id = p.manager_id
  WHERE p.is_active = true
    AND (v_team IS NULL OR p.team_id = v_team)
    AND (v_state IS NULL OR p.state = v_state)
    AND (v_role IS NULL OR public.get_primary_role(p.id) = v_role)
  ORDER BY total DESC NULLS LAST, p.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.company_leaderboard(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_leaderboard(jsonb) TO authenticated, service_role;