# Apply pending migrations + turn on real email sending

Four database changes were written but never applied, and the four emails currently only render into a stub queue instead of being delivered. This finishes both.

## 1. Apply the four pending database changes

In order, as one migration each:

1. **Overview tracking** — adds "overview scheduled" and "overview completed" timestamps on applicants, so recruiters can mark an overview booked/held outside Calendly. The completed timestamp gates the evaluation form.
2. **Evaluation → auto-hire** — adds a hire timestamp on applicants and a lifetime hires counter on agent profiles; rewrites evaluation submission so a submitted evaluation matches the applicant, moves them to Licensing (unlicensed) or Contracting (licensed), stamps the hire once, and credits the attributed recruiter. Adds a safe prefill lookup so the evaluation link can pre-populate name/email/licensing.
3. **Email outbox** — a log table of every email the app queues, readable only by managers and admins, written only through a guarded function.
4. **CRM upgrades** — adds "last follow-up sent" (drives the pre-licensing pipeline sort and weekly follow-up tracker) and a manual "Discord confirmed" flag for unlicensed hires.

These match the already-shipped portal and application code, which currently references columns that don't exist yet — so applying them also fixes the CRM, dashboard, and application flows that depend on them.

## 2. Ship the four emails for real

Email sending on `notify.apex-vanguard.com` is verified and ready. Set up the project's app email system and convert the four existing hand-rolled HTML templates into real, previewable templates in the Vantage brand (black/gold, Bebas + DM Sans headings, white email background for deliverability):

| Email | Sends when |
| --- | --- |
| Application received — licensed | Licensed applicant submits the application |
| Application received — unlicensed | Unlicensed applicant submits the application |
| Welcome / you're hired | Evaluation submitted and auto-hire fires (branches on licensing status) |
| Course check-in | Recruiter clicks "Send follow-up email" in the CRM |

Copy, links (overview booking, licensing course, Discord, 1:1 call), and subjects stay exactly as written today.

## 3. Wire real delivery behind the existing call sites

The three existing trigger points (application submit, evaluation auto-hire, CRM follow-up) already call one shared helper. That helper changes from "render + queue only" to "send through Lovable Emails, then log the outcome to the outbox" — so nothing at the call sites changes, delivery becomes real, and managers keep an inspectable record in the outbox with `sent` / `failed` / `skipped` status.

Behavior preserved: a delivery failure never breaks an application submission or a hire — it is recorded and swallowed.

## Technical notes

- Migrations applied verbatim from `supabase/migrations/20260811120000_overview_tracking.sql`, `..._evaluation_autohire.sql`, `..._email_outbox.sql`, `..._crm_upgrades.sql`.
- App emails scaffolded into `src/lib/email-templates/` (React Email + registry + server-only send helper + dashboard preview route); the four templates are ported from `src/lib/emails/templates.ts`.
- `src/lib/emails/send.ts` keeps its `queueEmail` signature; internally it calls `sendTemplateEmail` with an idempotency key derived from applicant id + template, then records the result via the `enqueue_email` function with the resulting status.
- No queue drainer, cron job, or unsubscribe page — Lovable handles delivery, retries, suppression, and unsubscribe.
