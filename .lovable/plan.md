# Discord invite in every applicant email + corrected licensing flow

## 1. New licensing links and partner code

One source of truth updated once, and every page/email follows:

| Item | New value |
| --- | --- |
| Pre licensing course | https://partners.xcelsolutions.com/afe |
| Partner code | AFE (replaces karmakore) |
| State requirements | https://partners.xcelsolutions.com/insurance-license/requirements?partner=afe |
| Apply for license | https://nipr.com |

Every hardcoded "karmakore" mention in the success pages and email copy is replaced with the shared constant, so the old code can't reappear.

## 2. Corrected licensing flow — three ordered steps

Everywhere licensing is explained (unlicensed success page, course-confirmed page, and the licensing/pre-licensing/exam emails) the steps read in this order:

1. Life Insurance Pre Licensing — start the Xcel course, partner code AFE
2. State Requirements — check your state's exact steps
3. Apply for License — apply on nipr.com (plus fingerprinting if your state requires it)

Each step gets its own labeled button/link rather than a link buried in a sentence.

## 3. Discord invite in every applicant email

Today only some applicant emails mention Discord. Instead of pasting it into 25 templates, the shared email renderer adds a standing Discord invite block to the bottom of every applicant-audience email — one short line plus the Discord link — right above the footer. Agent and security emails are unaffected.

Templates that already lead with a Discord button (overview confirmation, application received, follow ups) keep that button; the automatic block is suppressed there so nobody gets the same link twice in one email.

The standalone React Email templates that don't go through the catalog renderer (application received, welcome, follow up check in) get the same block through their shared shell.

## 4. Pages to update

- Unlicensed application complete page — three-step flow, new code AFE, Discord button.
- Licensed application complete page — new course link/code where shown, Discord button.
- Course confirmed page — next steps end with state requirements then nipr.com.

## Technical notes

- `src/lib/next-steps.ts`: `XCEL_COURSE_URL` → `/afe`, `XCEL_PARTNER_CODE` → `AFE`, add `NIPR_URL`.
- `src/lib/email/links.ts`: `STATE_REQUIREMENTS_URL` → `partner=afe`; add `nipr_link` to the email context/vars so copy can token it.
- `src/lib/email/render.server.ts`: append the Discord block for `def.audience === "applicant"` unless the template's CTA already points at `{{discord_link}}`; pass through `GenericEmail`.
- `src/lib/email-templates/_shell.tsx`: optional Discord footer block for direct-rendered templates; drop the literal "karmakore" in `application-unlicensed.tsx`.
- `src/lib/email/catalog.ts`: reorder/relabel the licensing steps in the licensing, pre-licensing, exam and reminder templates; remove now-duplicated Discord lines where the automatic block covers them.
- No schema or send-infrastructure changes; admin subject/body overrides still win over catalog copy.
