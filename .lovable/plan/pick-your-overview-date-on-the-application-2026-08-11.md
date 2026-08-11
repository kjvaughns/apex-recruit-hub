# Pick your overview date on the application

## The short answer

Almost — with one honest limitation. Calendly's API can tell us your real open Monday slots, and it can pre-fill a booking, but it does not allow another system to create a booking on an invitee's behalf. The final confirm has to happen on Calendly. Anything claiming otherwise would silently break.

So the flow becomes: applicants pick a Monday from a required dropdown on the application, and the moment they submit they land on a page where the booking is already filled in (their date, time, name, email) and one tap confirms it. In practice it feels like the application booked them — one extra tap instead of hunting through a calendar.

## What applicants see

1. On `/apply`, a new required field: "Which Monday overview can you attend?" — a dropdown of the next few real open Mondays at 7:00 PM CST, pulled live from your Calendly, shown in the applicant's own timezone as well.
2. They submit as usual and go to the same licensed / unlicensed completion page.
3. That page opens the Calendly overview for the exact slot they chose with their name and email pre-filled — one click to confirm.
4. Confirming fires your existing Calendly webhook, which already stamps the applicant as scheduled and moves them in the pipeline. No change there.

If Calendly is unreachable or has no open Mondays, the dropdown quietly falls back to the current behavior (full Calendly embed, no forced pick) so applications never get blocked.

## What gets stored

The chosen slot is saved on the applicant so the pipeline shows an intended date even before they confirm on Calendly. When the webhook confirms, the real event data takes over as it does today.

## Technical notes

- Link the existing "KJ's Calendly" workspace connection to this project via the connector tool, then call Calendly through the Lovable gateway from a server function (never the browser).
- New server function `getOverviewSlots` in `src/lib/applications.functions.ts`: resolve `/users/me`, find the overview event type, call `event_type_available_times` for the next ~4 weeks, keep only Monday 19:00 America/Chicago starts, cache the result briefly. Returns a small DTO of `{ startIso, label }`.
- `src/routes/apply.tsx`: add an `overview_slot` field to form state + validation, rendered with the existing `Field` / select styling.
- `src/lib/applications.functions.ts` schema gains an optional `overview_slot` ISO string, passed through to `submit_application`.
- Migration: add `requested_overview_at timestamptz` to `applicants` and have `submit_application` persist it; surface it read-only on the applicant detail/CRM views alongside the confirmed Calendly time.
- Completion pages (`application-complete/licensed.$token.tsx`, `unlicensed.$token.tsx`) build the Calendly URL with `month`, `date`, and time params plus `name`, `email`, and the existing `utm_content` token so the webhook still matches; keep the current embed as the fallback path.
- No change to the Calendly webhook route, RLS, auth, or pipeline logic.
