# Vantage Recruiting Journey — One Connected System

Goal: application → overview → evaluation → hired → licensing → onboarding → training → active runs as one automated workflow on a single applicant record, with branded email at every step and a full activity timeline.

## What's true today (verified)

- Stages already exist and match your list, plus 4 retired ones still in the table (Attempting Contact, Contacted, Pre-Contracting, Contracting) — they're flagged archived, so the flow is already the 10 you listed.
- `applicants` already has `recruiting_status` (defaults `pending`), `npn`, `resident_state`, interview/Calendly fields, onboarding steps.
- No fields exist yet for the state exam (date/time/provider/result) or for a secure applicant action link.
- The Calendly webhook sets Interview Scheduled and logs activity, but doesn't handle reschedule (start-time change on an existing event) and sends no confirmation.
- Reminders today are a single 24-hour email; there is no multi-touch interview or no-show sequence.
- Account creation goes through a secure invitation with password + NPN, but it moves the applicant to Active, doesn't sign the person in, and lands them on `/portal` instead of onboarding.
- "Signals" appears once in the portal — the applicants table column header.
- The onboarding page collapses every step in Super Admin preview mode (only step 1 expands, and completion actions are hidden).

## Phase 1 — Data + safety foundation

One migration adds:

- Exam fields on applicants: exam date/time, testing provider, exam notes, exam result, exam passed date.
- Timeline stamps: pre-licensing entered, course confirmed, licensing entered, training started.
- `applicant_action_tokens` — single-use, expiring, hashed tokens for applicant-facing buttons ("I've Purchased My Course"), so no raw applicant ID is ever in a link.
- `applicant_sequences` — one row per active campaign per applicant (interview reminders, no-show follow-up, exam reminders) with next-send time, touch count, and stop reason, so sequences can be started/stopped deterministically.
- Reuses the existing `email_send_keys` dedupe table for every send, and idempotency guards keyed on Calendly event id + start time.

## Phase 2 — Statuses (rename from Signals)

- Rename the portal column and any label to **Statuses**.
- Status values: Pending, Hired, Follow Up, No Show, Not Interested, Not Qualified, Inactive, Terminated — editable on the record independent of Stage, with Hired badges shown alongside the stage chip everywhere (list, kanban, drawer).
- Hired is explicitly separate from the Active stage.

## Phase 3 — Central stage engine

A single server-side `applyStage(applicant, stage, actor, reason)` path that every caller uses (recruiter action, Calendly webhook, evaluation, course-purchase link, onboarding completion). It writes stage + stage history, sets the matching status/stamps, logs the timeline entry, fires the stage email, and starts/stops sequences. All automation calls this — nothing updates `current_stage_id` directly.

## Phase 4 — Calendly + interview reminders

- Application submit matches by email then phone, updates the existing record, and if Calendly already shows an upcoming Company Overview: Stage = Interview Scheduled, interview date/time, event id, interview status Scheduled, calendar entry, activity "Company Overview Scheduled".
- Reschedule updates the same appointment, keeps the old one in activity, and re-sends confirmation.
- Reminder sequence at ~6, ~4, ~2 days out (skipped if the appointment is nearer than the touch), plus a final day-before touch. Stops on cancel, reschedule (restarts), evaluation completion, Not Interested, or Terminated.
- Every reminder carries first name, date, time, timezone, instructions, and a reschedule button.

## Phase 5 — Evaluation → Hired → course purchase

- Evaluation completion matches the record, stores responses, sets Stage = Interview Completed and Status = Hired, logs "Evaluation Completed" + "Conditionally Hired", stops interview reminders, and sends the Selected email.
- Selected email: congratulations, what's next, licensing course link + code, Discord, licensing steps and timeline, and an **I've Purchased My Course** button on a single-use token link. Clicking verifies the token, moves Stage = Pre Licensing (Status stays Hired), logs "Licensing Course Confirmed", and shows a branded success page. A second click shows the same success page — no duplicate event.
- Recruiters can still move someone to Pre Licensing manually.

## Phase 6 — Pre Licensing → State Exam → Licensing

- Pre Licensing email: what to complete, timeline, daily expectations, recruiter contact, Discord, licensing resources, and an admin-editable **Licensing Cheat Sheet** slot that can point at an Academy Library item or a URL set in template settings (empty for now, so the section simply hides until you add it).
- Recruiter can set exam date/time/provider/notes; that sets Stage = State Exam, shows prominently on the applicant card, adds the exam to the recruiting calendar, and starts exam reminders at 3 days, 1 day, and the morning of — to both applicant and assigned recruiter.
- "Mark exam passed" sets Stage = Licensing, result Passed with the passed date, activity "State Exam Passed", and sends Licensing Next Steps (apply, fingerprinting, background, wait for NPN, notify recruiter) with no state-specific legal claims.

## Phase 7 — Onboarding handoff + account setup (rebuild)

- Moving to Onboarding creates/reuses one Account Setup Invitation (never a silent completed account, never a duplicate), links the applicant to the agent profile, initializes the checklist, and sends the onboarding email.
- Setup page prefills first/last name, email, phone, resident state from the applicant record and asks only for NPN + password/confirm, with a review of existing info. On submit it creates the auth account, links applicant ↔ profile, signs them in, and routes straight to `/portal/onboarding`.
- Onboarding email mirrors the in-portal checklist in full: AgentSpace contracting (agency code, NPN verify, refresh note, SureLC steps, request contracts until Pending, notify Vantage), Discord role update via the Start Here → New App → Licensed Agent flow with the invite link, Agent Playbook from the Academy Library, agent expectations and the full weekly schedule (Mon 9:30 AM team meeting, Mon ~10:30 AM new agent training, Mon 7:00 PM company overview, Wed 10:30 AM agency training, Tue/Thu 6:00 PM film review, live dials 10–6 daily), and the Vantage Closer Course before live training — ending in **Start Onboarding**.

## Phase 8 — Fix the onboarding page

Every step becomes an expandable card with its complete content — Discord URL and instructions, playbook route, expectations, schedule, production standards, Closer Course link, AgentSpace + SureLC instructions, completion actions — and Super Admin preview mode can expand and inspect all of them (completion actions render disabled rather than hidden).

## Phase 9 — Onboarding completion → Training

Final requirement checked ⇒ onboarding marked complete with completion date, Stage = Training (Status stays Hired), activity "Onboarding Completed" + "Training Started", Training Start email sent, recruiter/trainer notified. No manual admin move required.

Training email covers start date, first team meeting, the full schedule above, Discord training room, expectations, what to prepare, Closer Course status, live-dial and camera expectations, with an **Open Vantage Academy** CTA.

## Phase 10 — No Show / Follow Up

- Marking No Show (manually or from Calendly non-attendance) keeps the stage, starts a capped follow-up sequence: immediately, +2 days, +4 days, using the "We Missed You" email with a Calendly reschedule CTA. Stops on reschedule, recruiter status change, Not Interested, or Terminated.
- Quick action **Start Follow Up** on the record; setting Status = Follow Up starts the same campaign.

## Phase 11 — Templates, branding, timeline

- Stage-based templates wired for: New Applicant, Interview Scheduled, Interview Reminder, Interview Completed / Hired, Pre Licensing, State Exam Scheduled, State Exam Reminder, Licensing, Onboarding, Training, Active, Terminated, No Show, Follow Up, Not Moving Forward — each editable in Admin Email Templates showing trigger, subject, body, available variables, enabled toggle, and last updated.
- Shared branded shell: logo, Vantage name, black/charcoal/white, gold CTA, mobile-responsive, first-name greeting, professional footer, and a clickable Instagram icon + link (instagram.com/vantage.financial) on every non-security email.
- Every automation writes a timeline entry (application, scheduled, rescheduled, reminder sent, evaluation, hired, course confirmed, stage moves, invite sent, account created, onboarding complete, training started, email sent, no show, follow-up started).

## Phase 12 — End-to-end test

Drive the whole journey in a headless browser plus direct server-function calls: apply → scheduled → reminders queued → evaluation → hired email → course button → pre licensing → exam scheduled/reminders → passed → licensing → onboarding invite → setup with NPN + password → signed in on the onboarding checklist → complete all steps → training auto-set and email sent. Verify no duplicate records, emails, calendar events, or stage events (including replaying the Calendly webhook and double-clicking the course button), correct CT/timezone rendering, and working Instagram + CTA links.

## Assumptions

- Terminated / Not Moving Forward emails exist as templates but stay disabled by default; you can enable them in Admin.
- Licensing cheat sheet section stays hidden until you supply the file or link.
