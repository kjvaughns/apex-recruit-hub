create or replace function public.get_applicant_notify_context(_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  a public.applicants;
  rec public.profiles;
begin
  if _token is null or length(_token) < 10 then
    return jsonb_build_object('found', false);
  end if;

  select * into a from public.applicants where confirmation_token = _token limit 1;
  if a.id is null then
    return jsonb_build_object('found', false);
  end if;

  select * into rec from public.profiles
   where id = coalesce(a.assigned_recruiter_id, a.original_recruiter_id, a.referred_by_profile_id)
   limit 1;

  return jsonb_build_object(
    'found', true,
    'applicant_id', a.id,
    'first_name', a.first_name,
    'last_name', a.last_name,
    'email', a.email,
    'phone', a.phone,
    'state', a.state,
    'licensed', a.licensed,
    'instagram_handle', a.instagram_handle,
    'why_text', a.why_text,
    'requested_overview_at', a.requested_overview_at,
    'wants_one_on_one', coalesce(a.wants_one_on_one, false),
    'referred_by_name', coalesce(a.referred_by_name_snapshot, a.referred_by_name),
    'recruiter_id', rec.id,
    'recruiter_name', coalesce(rec.full_name, trim(coalesce(rec.first_name,'') || ' ' || coalesce(rec.last_name,''))),
    'recruiter_email', rec.email
  );
end;
$$;

revoke all on function public.get_applicant_notify_context(text) from public;
grant execute on function public.get_applicant_notify_context(text) to anon, authenticated, service_role;

create or replace function public.get_recruiter_for_applicant(_applicant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  a public.applicants;
  rec public.profiles;
begin
  select * into a from public.applicants where id = _applicant_id limit 1;
  if a.id is null then
    return jsonb_build_object('found', false);
  end if;
  select * into rec from public.profiles
   where id = coalesce(a.assigned_recruiter_id, a.original_recruiter_id, a.referred_by_profile_id)
   limit 1;
  if rec.id is null or rec.email is null then
    return jsonb_build_object('found', false);
  end if;
  return jsonb_build_object(
    'found', true,
    'recruiter_id', rec.id,
    'recruiter_name', coalesce(rec.full_name, trim(coalesce(rec.first_name,'') || ' ' || coalesce(rec.last_name,''))),
    'recruiter_email', rec.email
  );
end;
$$;

revoke all on function public.get_recruiter_for_applicant(uuid) from public;
grant execute on function public.get_recruiter_for_applicant(uuid) to authenticated, service_role;