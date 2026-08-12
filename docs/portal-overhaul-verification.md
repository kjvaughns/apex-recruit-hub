# Vantage Portal Overhaul — Verification Checklist

This overhaul shipped as a sequence of PRs (#31–#39), each merged to `main` after a clean
`tsc --noEmit` + `bun run build`. This document maps every requested behavior to where it landed and
its status. Migrations are committed only (applied on deploy).

## PR map
| PR | Area |
| --- | --- |
| #31 | Recruiting data-model foundation (stages, `recruiting_status`, `npn`/`resident_state`) |
| #32 | Applicants CRM — side drawer, inline edit, activity timeline, follow-ups |
| #33 | Evaluation system — full questionnaire, auto-match, internal score |
| #34 | Email actions — Send Email composer + template catalog |
| #35 | Onboarding upgrade — 5 steps, notifications, admin agent profile |
| #36 | Academy hub — 3 sections, simplified Library |
| #37 | Calendar — Month/Week/Day + clickable event details |
| #38 | Leaderboard — Recruiting board, podium, rank movement |
| #39 | Settings functional + remove Invitations |

## Onboarding
- [x] More prominent nav (persistent sidebar item + badge) and a dashboard progress card.
- [x] Checklist with saved progress (`applicants.onboarding_steps` + `update_onboarding`).
- [x] Account-setup fields (First/Last/Email/Phone/NPN/Resident State) captured on the profile
      (Settings › Profile persists NPN + Resident State).
- [x] Step 1 AgentSpace Contracting — agency-code copy, NPN verify note, refresh tip, training-video
      callout, "I Completed Contracting" → completes + notifies leadership.
- [x] Step 2 Update Discord Role — Start Here → New App → Licensed Agent + invite link + Mark Complete.
- [x] Step 3 Read the Agent Playbook — Open Agent Playbook (Academy library) + I Have Read the Playbook.
- [x] Step 4 Agent Expectations & Schedule — schedule + standards + required agree checkbox.
- [x] Step 5 Complete the Vantage Closer Course — Start button + auto-completes on course completion.
- [x] Completion screen + Notify Trainer (email + activity event).
- [x] Old "Portal Account Setup" step removed.
- [x] Completion % on Agent Dashboard, Admin Agent Profile (`/portal/admin/users/$userId`), and the
      recruiting/onboarding pipeline pill.
- ⚠️ Action needed: create the Academy course slug `vantage-closer` and library slug `agent-playbook`
      so those step links resolve.

## Applicants CRM
- [x] Compact side drawer (deep-linkable `?open=`), not a separate full page.
- [x] Inline-editable fields incl. NPN, Resident State, Stage, Status, Assigned recruiter, Next follow-up.
- [x] New recruiting stages (New Applicant → … → Active/Terminated; Pre Licensing + State Exam added).
- [x] Separate Status field (`recruiting_status`) independent of Stage.
- [x] Evaluation: standalone link removed; readable "View Evaluation" with internal score.
- [x] Send Email button with template catalog + preview/edit; sends logged to the timeline.
- [x] Stage→Onboarding automation (welcome/onboarding invite, checklist seed, activity logs).
- [x] Activity timeline with manual logging (Called/No Answer/VM/Text/Email/Spoke With/… + follow-ups).
- [x] Quick actions (Call/Text/Send Email/Log Activity/Schedule Follow Up/Change Stage) + upcoming
      follow-up surfaced on the card.

## Evaluation system
- [x] Public `/evaluation` with the full questionnaire; auto-matches to the applicant (no duplicates).
- [x] On match: Stage → Interview Completed, Status → Hired, `evaluation_completed` logged.
- [x] Internal 0–100 guidance score (never auto-approves/rejects), shown in the profile.
- ℹ️ Calendly stays a booking link; overview scheduled/rescheduled/attended are logged as activity
      (no live webhook — a deliberate scope decision).

## Calendar
- [x] Clickable events → detail modal (name/date/time/type/related record/status/notes).
- [x] Month / Week / Day views; Mine/All; appointment/task color legend.
- [x] Appointment events open the applicant record; task events support Complete/Delete.

## Leaderboard
- [x] Recruiting board: podium top-3, You highlight, positional rank movement, filters
      (period/role/team), columns Applicants/Interviews/Hires/Activated/Conversion.
- [x] Production board present as "Coming soon" (no production data source exists yet).

## Academy
- [x] Hub with three cards: Recorded Presentations, Courses, Library.
- [x] Library simplified — tag chips removed; search + optional category/folder.
- [x] Recorded Presentations section (video cards).
- [x] Vantage Onboarding course removed.

## Settings
- [x] Profile persists to the backend (incl. NPN, Resident State, photo → public URL); phone validated.
- [x] Change Password requires the current password (re-auth) with success/error states.
- [x] Notification toggles aligned + persisted to `profiles.notification_prefs`.
- [x] Invitations page removed from nav/routes; Add Agent + promote + onboarding invite retained.

## Build
- [x] `npx tsc --noEmit` and `bun run build` clean on integrated `main`.
