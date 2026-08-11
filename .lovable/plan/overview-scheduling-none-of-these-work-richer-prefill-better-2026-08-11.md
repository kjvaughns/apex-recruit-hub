# Overview scheduling: "none of these work", richer prefill, better thank-you page

## 1. "None of these dates work for me" option

- The overview date dropdown on `/apply` gains a final option: **None of these work — I'd like a 1:1 call**.
- Choosing it clears the requested overview slot and flags the applicant as needing a 1:1.
- On the thank-you page, that applicant sees a **Book a 1:1 call** card instead of the "confirm your seat" card, pointing at the right leader's 1:1 Calendly link (pre-filled with their details).
- Licensed applicants keep their existing recruiter interview flow and also get the 1:1 option.

### Whose 1:1 link
Resolved server-side by walking up the org hierarchy from the applicant's recruiter:
the nearest person above them whose role is **leader** (or manager/admin) with a saved
1:1 link wins; if nobody in the chain has one, it falls back to the company owner link
stored in settings (your link).

### New portal setting
A **1:1 call link** field is added to Portal → Settings → Recruiting, next to the existing
licensed scheduling link, editable by leaders, managers and admins. Same validation and
"Test link" behavior as today.

## 2. Prefill phone number and referrer

The Calendly confirm URL will pre-fill:
- name, email (already working)
- **phone number** (mapped to the event's phone question)
- **who referred them** (recruiter name, mapped to the referral question)

Both come from the application record, so applicants never retype them.

## 3. Keep them on the rich thank-you page

Today, tapping "I've booked" or the confirm button sends people to the plain
"Application received" screen. That stops. After booking they stay on their own
thank-you page, which now shows a confirmed state plus the full next-steps content:

- Confirmed overview date (or 1:1 call), with a link to reschedule
- **Start your pre-licensing course** → Xcel Solutions link, with **Partner code: karmakore** shown clearly and copyable
- **Join the Discord** → https://discord.gg/Tgf8M9kgSz
- The existing 3-step "what happens next" and licensing checklist stay

The same course link + partner code and Discord link are added to the licensed
thank-you page and to the application-received emails so nothing is lost if they
close the tab.

## Technical notes

- Migration: add `one_on_one_calendly_url` / `one_on_one_calendly_updated_at` to `profiles`;
  add a `wants_one_on_one` flag to `applicants`; store the owner fallback link in
  `system_settings`.
- New/updated RPCs: extend `get_overview_prefill` to return phone + referrer name +
  resolved 1:1 link (hierarchy walk via `parent_user_id` + `user_roles`); extend
  `set_requested_overview` to accept the "none" case.
- `src/lib/calendly.server.ts`: `buildPrefilledUrl` gains phone + referrer answer params.
- `src/lib/applications.functions.ts`: pass `wants_one_on_one` through submission and
  return the 1:1 URL from `getOverviewBooking`.
- `src/routes/apply.tsx`: add the dropdown option; keep validation working when chosen.
- `src/routes/application-complete/unlicensed.$token.tsx` and `licensed.$token.tsx`:
  remove the redirect to `/application-complete`, add confirmed state, course/partner-code
  and Discord cards.
- `src/lib/portal.functions.ts` + `settings.tsx`: 1:1 link get/save with role checks.
- Email templates: add course + partner code + Discord blocks.
