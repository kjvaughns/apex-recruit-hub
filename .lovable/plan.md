# Vantage Financial — Complete Email System

Everything in one pass: one branded template system, all recruiting and account emails, event triggers, working notification preferences, admin template + campaign management, full email history, an upgraded Send Email modal, and scheduled reminders/campaigns.

## Decisions locked in

- Rejection / no-show emails: manual send only, never automatic.
- Scheduler enabled in the backend; daily sends at 7:00 AM CT, weekly Game Plan Monday 7:00 AM CT, reminder sweep hourly.
- Admins can override subject and body copy per template; branding, layout and variables stay locked to the shared shell, with restore-to-default.
- Sending stays on the existing verified sender (`notify.vantage-financial.net`) through the platform's managed email service — no new provider, no keys in the frontend.

## 1. One shared email system

Consolidate today's two parallel systems (the React Email templates in `src/lib/email-templates/` and the older hand-rolled HTML in `src/lib/emails/`) into a single React Email pipeline built on the existing `_shell.tsx`.

- Shell gains: Vantage wordmark/logo, dark card on white canvas, gold CTA, mobile-safe widths, contact + legal footer, and an optional "Manage email preferences" footer line for optional emails.
- Reusable pieces: `Shell`, `GoldButton`, `Paragraph`, `Bullets`, `DetailTable` (for date/time/recruiter rows), `Signoff`.
- One variable resolver: every template is rendered from a single context object (`first_name`, `last_name`, `email`, `interview_date`, `interview_time`, `evaluation_link`, `onboarding_link`, `portal_link`, `academy_link`, `calendar_link`, `recruiter_name`, `agency_name`, plus course/discord/overview links). Missing values fall back to safe copy; the send path refuses to send if a required variable for that template is empty, logging a failure instead of shipping a broken email.
- Dates/times render in the recipient's timezone (profile `timezone`, else America/Chicago) with the zone shown.
- Delete the legacy `src/lib/emails/catalog.ts` HTML builders once all callers move over.

## 2 & 4. Templates

All 21 applicant templates from the request (evaluation request, interview + overview confirmations and reminders, follow up, reschedule, accepted, welcome, licensing instructions, onboarding invitation, resend welcome/onboarding, training instructions, not moving forward, no show follow up, licensing/onboarding/training/first-day reminders) plus the agent/account set (portal invitation, verification, password reset, password changed, email changed, onboarding started/step reminder/completed, training assigned, course completed, certification passed/retake, meeting reminder, agency announcement, manager notification, applicant follow-up reminder, new agent assigned, important notification).

Each: one subject, greeting, 2–4 short lines, one primary CTA, correct links, footer. Existing auth templates (signup, recovery, magic link, email change, reauthentication) get re-skinned to the same shell so account emails match.

## 3. Automatic recruiting triggers

Triggers fire from the places these events already happen (application submit, Calendly webhook, stage change, evaluation submit, promotion to agent) via a single `dispatchEmailEvent(event, applicantId)` server helper, so no route re-implements email logic.

- Interview/overview scheduled or rescheduled → confirmation with the updated slot; Calendly reschedule updates the applicant record first.
- Evaluation requested → evaluation request with the applicant-specific link; completion logs to the timeline.
- Stage → Hired / Licensing / Onboarding / Training sends the matching email set; Onboarding also creates the portal invitation if one doesn't exist.
- Not moving forward / no show: template ready, manual send only.
- Duplicate protection: a unique send-key per (applicant, template, event window) plus idempotency keys means a webhook firing twice sends once.
- Recruiter copy behaviour stays as-is.

## 5. Notification preferences that actually work

`profiles.notification_prefs` becomes an explicit, defaulted set of keys matching the Settings toggles (email master, recruiting updates, applicant follow ups, training reminders, meeting reminders, agency announcements, onboarding updates) plus per-campaign subscription keys. Every optional send re-reads preferences server-side before delivering; security/account emails ignore preferences and are shown as non-disableable in Settings.

## 6. Admin → Email Templates

New table for template overrides. Admin screen lists every template with its trigger, lets you preview (rendered in the real shell), edit subject/body copy, enable/disable, send a test to yourself, and restore defaults. Available variables are listed per template, and saving warns if a required variable was removed.

## 7. Email history

`email_outbox` is extended into a proper log: recipient, template, subject, sent time, status (queued/sent/delivered/failed/bounced/suppressed), related applicant and/or agent, automated vs manual, sent-by user, provider message id. A delivery-events webhook route updates status for bounces, complaints and unsubscribes. History renders in the applicant timeline, the agent profile activity, and a new Admin → Email Logs view with filters.

## 8. Send Email modal

Recipient shown, template picker, auto-populated subject/body with live preview, editable before sending, the CTA link surfaced, plus a fully custom option. On send: success toast, modal closes, the activity list updates in place with no refresh.

## 9–17. Campaigns, reminders, admin campaign manager

- Settings → **Email Subscriptions**: agents opt in per campaign (Daily Production Focus, Weekly Game Plan, Weekly Sales Tip, training/film review/meeting reminders, announcements, new Academy content, leadership development). Nothing optional is on by default.
- Daily Production Focus (7:00 AM CT): target, dial hours, one focus, optional Academy lesson, portal CTA. Short.
- Weekly Game Plan (Mon 7:00 AM CT): meeting time, weekly schedule, training/film review times, dial expectations, admin-entered weekly message, featured resource.
- Weekly Sales Tip: admin-selected Academy lesson or custom copy, linking to the lesson.
- Event reminders from portal calendar events at 24h and 1h, deduped per event+recipient+offset, respecting meeting-reminder prefs.
- Onboarding reminders: first nudge 24h after start with no progress, then a small capped series, stopping immediately on completion; shows completion % and next step.
- Training: assigned email, deadline reminder, completion confirmation; Vantage Closer Course prerequisite called out when required.
- Admin → **Email Campaigns**: name, audience, status, schedule, subscribers, last/next send, with enable/disable, edit content, send test, send now, view history. Deliberately simple — operational, not a marketing automation suite.
- Audience rules (all active agents, new, onboarding, training, managers, leadership, team, single agent, subscribers only) validated server-side; inactive/terminated agents are always excluded.

## 18. Unsubscribe

Optional recurring emails carry a "Manage email preferences" link to a per-category preference page. No global kill switch that could silence security emails.

## 20. Final audit

End-to-end pass across application → evaluation → interview → reschedule → acceptance → licensing → onboarding → invitation → training, plus password reset, preference toggles, manual send, one campaign, and a calendar reminder. Verified: correct recipient and name, correct links, correct date/time and timezone, mobile layout at 390px, logged row, timeline entry, preferences respected, no duplicates, no unresolved variables.

## Technical notes

- Backend: enable `pg_cron` + `pg_net`; schedule sweeps against `/api/public/hooks/email-*` routes (hourly reminder sweep, 7:00 AM CT daily, Monday weekly).
- New tables: `email_templates` (overrides), `email_campaigns`, `email_campaign_subscriptions`, `email_send_keys` (dedupe), plus `email_outbox` column additions. All with RLS + GRANTs; agents read only their own rows, admins read all.
- Server-only sends via `src/lib/email/` (renderer, context resolver, preference gate, dispatcher). Nothing email-related imported into client components.
- Delivery-status webhook at the platform's expected events route.
