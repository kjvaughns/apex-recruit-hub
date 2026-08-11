CREATE OR REPLACE FUNCTION public.enqueue_email(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_to text := lower(trim(coalesce(payload->>'to_email','')));
  v_status text := lower(coalesce(nullif(payload->>'status',''), 'pending'));
BEGIN
  IF v_to = '' THEN
    RAISE EXCEPTION 'to_email is required';
  END IF;
  IF v_status NOT IN ('pending','sent','failed','skipped') THEN
    v_status := 'pending';
  END IF;
  INSERT INTO public.email_outbox (
    to_email, to_name, subject, html, template_key, applicant_id, status, sent_at, error
  )
  VALUES (
    v_to,
    nullif(payload->>'to_name',''),
    coalesce(payload->>'subject',''),
    coalesce(payload->>'html',''),
    coalesce(payload->>'template_key','unknown'),
    nullif(payload->>'applicant_id','')::uuid,
    v_status,
    CASE WHEN v_status = 'sent' THEN now() ELSE NULL END,
    nullif(payload->>'error','')
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_email(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email(jsonb) TO anon, authenticated, service_role;