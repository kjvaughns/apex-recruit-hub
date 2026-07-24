
## Scope

The unlicensed applicant flow is `/apply` → `/schedule` → `/application-complete`. The `/schedule` page currently renders whatever URL is stored in `system_settings.calendly_url` inside a plain `<iframe>`. Swap that step over to your specific Calendly link, rendered via Calendly's official inline widget so branding params (`primary_color=e6b400`, hide event details, hide GDPR banner) actually take effect.

## Changes

1. **Update the stored URL** (so Admin → Settings stays the source of truth):
   - Set `system_settings.calendly_url` to
     `https://calendly.com/kjvaughns1/overview?hide_event_type_details=1&hide_gdpr_banner=1&primary_color=e6b400`.

2. **`src/routes/schedule.tsx`** — replace the raw `<iframe>` block with Calendly's inline widget:
   - Inject `https://assets.calendly.com/assets/external/widget.js` once via a `useEffect` (append `<script async>` to `document.body`, guarded so it's not added twice on re-renders / HMR).
   - Render `<div className="calendly-inline-widget" data-url={url} style={{ minWidth: 320, height: 720 }} />` inside the existing `apx-card` wrapper so the dark card + gold ring styling is preserved.
   - Keep the loader-provided `url` from `getCalendlyUrl` as the `data-url`, so the admin setting still drives it and the fallback default in `applications.functions.ts` also gets updated to the new URL.
   - Keep the existing "Open Calendly in a new tab" and "I've booked — continue" buttons and the `markScheduled` call as-is.

3. **`src/lib/applications.functions.ts`** — update only the hardcoded fallback in `getCalendlyUrl` from the old `apex-financial/overview` URL to the new `kjvaughns1/overview` URL with the same query params, so a fresh environment without a `system_settings` row still gets the right embed.

## Technical notes

- The licensed vs. unlicensed branching already routes unlicensed applicants through `/schedule` (that's the "book your overview" step in the intake funnel) and licensed applicants through `/evaluation`. No routing changes needed — this scopes cleanly to the unlicensed path as requested.
- Calendly's inline widget reads `data-url` on mount, so we must set it before `widget.js` runs. The `useEffect` order (set state → append script) handles that; if the script is already present, Calendly re-scans on `DOMContentLoaded`/manual init, so we also call `window.Calendly?.initInlineWidgets()` after injection to cover client-side navigations back to `/schedule`.
- No schema changes, no new tables, no new server functions. Purely a settings-value update + a presentational swap on one route.

## Verification

- Visit `/apply` → submit an unlicensed application → land on `/schedule` and confirm the Calendly inline widget loads with gold accent, no event-type details header, no GDPR banner.
- Confirm Admin → Settings still shows/edits the Calendly URL and that editing it there updates the embed on next visit.
