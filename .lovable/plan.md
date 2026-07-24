## Goal

Split the `/schedule` step into two distinct, branded success pages driven by the applicant's licensed answer, add per-manager licensed Calendly links (with admin fallbacks), and lay the groundwork for Calendly webhooks — without breaking the existing recruiter attribution.

## Routes (file paths → URLs)

- `src/routes/application-complete/licensed.$token.tsx` → `/application-complete/licensed/:token`
- `src/routes/application-complete/unlicensed.$token.tsx` → `/application-complete/unlicensed/:token`
- Keep the old `/application-complete` route as a generic fallback (no-token landing).
- Retire `/schedule` from the funnel (embed now lives on the unlicensed success page). Leave the file with a redirect for safety.

The `:token` is a short random string stored on the applicant row (see schema). Public users load the page by token; email is never in the URL.

## Database migration (single migration)

1. `applicants` — add columns:
   - `confirmation_token text unique` (generated on insert)
   - `success_page_type text` (`'licensed' | 'unlicensed'`)
   - `calendly_url_used text`
   - `scheduled_event_id text unique`, `scheduled_invitee_id text`, `scheduled_event_url text`
   - `scheduled_event_start timestamptz`, `scheduled_event_end timestamptz`
   - `scheduling_status text default 'pending'` (`pending | scheduled | canceled | fallback`)
   - `assigned_manager_id uuid references profiles(id)`
2. `profiles` — add `licensed_calendly_url text`, `can_schedule_licensed boolean default false`.
3. `system_settings` — seed keys:
   - `unlicensed_overview_calendly_url` (default `https://calendly.com/kjvaughns1/overview?hide_event_type_details=1&hide_gdpr_banner=1&primary_color=e6b400`)
   - `licensed_fallback_calendly_url`
   - `allow_recruiter_licensed_priority` (default `true`)
   - `allow_manager_licensed_priority` (default `true`)
4. `submit_application` RPC — extend to:
   - Generate `confirmation_token`.
   - Set `success_page_type` from `licensed`.
   - Resolve `assigned_manager_id` from recruiter's `manager_id`.
   - Return `{ id, token, success_page_type }`.
5. New RPC `resolve_scheduling_context(_token text)` — SECURITY DEFINER, returns only what the public page needs: first name, licensed flag, resolved calendly url, resolved contact name (recruiter/manager display name), and a `link_missing` flag. Encapsulates the licensed-priority resolution:
   1. assigned recruiter's link (if `can_schedule_licensed` + setting allows)
   2. original recruiter's link (same guard)
   3. assigned manager's link (if setting allows)
   4. team manager's link
   5. admin `licensed_fallback_calendly_url`
6. New RPC `mark_licensed_fallback(_token text)` — creates a high-priority task for the assigned recruiter/manager and an `applicant_activities` entry when the licensed page renders with no link. Called from the server function on page load, idempotent per applicant.
7. Grants + RLS: keep `applicants` staff-only. Public reads go through `resolve_scheduling_context` (SECURITY DEFINER, token-gated). Profiles' new fields: managers/admins can update own row; admins update any (`has_role`); agents only if `can_schedule_licensed = true`.

## Server functions (`src/lib/applications.functions.ts`)

- Replace `getCalendlyUrl` with `getSchedulingContext({ token })` that calls the new RPC.
- Update `submitApplication` handler to return the token + type from the RPC.
- Replace `markScheduled({ email })` with `markScheduledByToken({ token })` (existing email path stays as a safety net for the "I've booked" button).
- New `updateMySchedulingSettings({ licensed_calendly_url })` (auth'd, `requireSupabaseAuth`) — validates `^https://calendly\.com/[\w\-/?&=.%#]+$` before writing.

## Frontend flow

- `src/routes/apply.tsx`
  - After successful submit: `sessionStorage` first name only; navigate to `/application-complete/{type}/{token}` using the RPC response — no more `/schedule`.
- `src/routes/application-complete/unlicensed.$token.tsx`
  - Loader: `getSchedulingContext`.
  - Renders success confirmation ("Application received, {firstName}"), a short "next step" explainer, an APEX-styled dark card containing Calendly's inline widget (`data-url={ctx.calendly_url}` + `widget.js` injection, same pattern as current `CalendlyInline`), an "Open Calendly in new tab" button, and messaging that the process isn't complete until they pick a time.
  - Monday-only note in the plan below.
- `src/routes/application-complete/licensed.$token.tsx`
  - Same shell, tailored copy ("You're licensed — book with {recruiterName}"). Embeds the resolved licensed link.
  - If `link_missing`: no embed, professional fallback message, shows contact person's name, calls `mark_licensed_fallback` once.
- Both pages: black bg, gold accents, Bebas Neue heading, DM Sans body, responsive full-width embed on mobile, sticky "Open Calendly" CTA at small breakpoints.

## Manager portal — Scheduling settings

- New section on `src/routes/_authenticated/portal/admin/settings.tsx` (admin) AND a new **personal** scheduling panel available to any user whose role is manager/admin/super_admin, or agent with `can_schedule_licensed = true`. Simplest placement: extend the existing admin settings page for admin fields and add a small "My scheduling" card on `/portal` index (or a new `/portal/settings` route — I'll add `src/routes/_authenticated/portal/settings.tsx`).
- Fields on personal card:
  - Licensed Applicant Calendly Link (input, validated)
  - Status pill (Set / Not set / Invalid)
  - Test link (opens in new tab)
  - Preview embed (modal renders the Calendly inline widget with the entered URL)
  - Last updated timestamp, Save button
- Admin settings additions:
  - `unlicensed_overview_calendly_url`
  - `licensed_fallback_calendly_url`
  - `allow_recruiter_licensed_priority` (toggle)
  - `allow_manager_licensed_priority` (toggle)

## Monday-only scheduling — approach

Calendly doesn't publicly expose a query parameter that filters availability to a specific weekday. The reliable path is to configure the `overview` event's availability to Mondays only inside Calendly itself; the embedded widget then only shows Mondays. Recommendation in the plan: keep the embedded widget as-is and ask you to restrict the event's weekly hours to Monday in Calendly. Building a custom Monday-picker on top would require the private Calendly API (server-side token) and would duplicate scheduling logic — explicitly out of scope per your instructions ("Do not attempt to recreate Calendly scheduling logic manually").

## Webhook groundwork (no live processing yet)

- Add `src/routes/api/public/webhooks/calendly.ts` server route:
  - Verifies `Calendly-Webhook-Signature` HMAC against `CALENDLY_WEBHOOK_SECRET` (secret to be added when you're ready to wire it in Calendly).
  - Handles `invitee.created` / `invitee.canceled`.
  - Idempotent on `scheduled_event_id`.
  - Loads `supabaseAdmin` inside the handler; matches applicant by (a) UTM/tracking `applicant_token` on the invitee, then (b) invitee email lowercased.
  - On match: fill scheduled_event_* columns, move stage to `interview-scheduled` (both licensed and unlicensed for now — matches your recommendation), insert activity + a portal task/notification for the recruiter.
- Ship this route disabled-safe: if secret env is missing, returns 503 rather than accepting unsigned payloads.

## Security notes

- Public success pages are token-gated; token is 32-char random, stored on applicants, never exposes email/ids in URL.
- Licensed link resolution happens server-side inside a SECURITY DEFINER RPC — no recruiter/manager IDs sent to the browser.
- `licensed_calendly_url` writes: RLS + Zod URL validation server-side.
- No service-role key touched from client code.

## Verification

- `/apply` (unlicensed) → lands on `/application-complete/unlicensed/:token`, Calendly overview widget loads with gold theme.
- `/apply` (licensed, ref=someRecruiterWithLink) → lands on `/application-complete/licensed/:token`, embeds that recruiter's link. Without a link → fallback message + task created.
- Admin settings page saves both admin Calendly keys + toggles.
- Personal scheduling card validates URL, preview modal shows embed.
- Old `/schedule` route redirects; existing seeded `calendly_url` setting is preserved but unused.

## Not in scope this pass

- Custom "pick a Monday, then a time" UI backed by Calendly's private API.
- Full webhook end-to-end (needs the secret configured in Calendly by you); the receiving endpoint + DB fields are ready.
