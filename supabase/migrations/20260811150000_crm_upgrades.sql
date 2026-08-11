-- Phase 4 — CRM upgrades.
--
--  * last_follow_up_at powers the "Pre-Licensing Pipeline" sort (longest since
--    last follow-up first) and the Phase 5 weekly-follow-up tracker. It is set
--    whenever the "Send follow-up email" action runs.
--  * discord_confirmed is a manual flag for unlicensed hires — checked once a
--    recruiter has seen the applicant's course screenshot in Discord. No Discord
--    API integration in this pass.

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS last_follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS discord_confirmed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.applicants.last_follow_up_at IS
  'When the last pre-licensing follow-up was sent. Drives the weekly follow-up tracker.';
COMMENT ON COLUMN public.applicants.discord_confirmed IS
  'Manually set once an unlicensed hire has posted their course screenshot in Discord.';
