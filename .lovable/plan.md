## Scope reality check

The upload is ~2,650 lines of HTML plus a starter SQL migration, and the spec covers a full public site, applicant flow, agent portal, admin portal, CRM, pipeline, tasks, calendar, leaderboard, reports, resources, RBAC, RLS, emails, and demo data. Building all of that in one pass would produce something shallow and broken. I'll deliver it in reviewable phases, each ending in a working app you can click through. After each phase you approve and I start the next.

I'll preserve the exact visual language from the uploaded HTML: black `#000`, gold `#C9A84C`, ivory `#F4F2ED`, Bebas Neue + DM Sans, the dark cards, gold hairlines, and restrained shadows. Design tokens go into `src/styles.css`; the uploaded HTML is translated into React components, never shipped as-is.

## Phase 1 — Foundation, public site, applicant funnel (this build)

Goal: a new visitor can land on the site, apply through a recruiter's referral link, schedule, and complete evaluation. Data lands in Supabase. No portal yet.

1. **Design system**: replace the default tokens in `src/styles.css` with the APEX palette; register Bebas Neue + DM Sans via `<link>` in `__root.tsx`; update root `head()` metadata (title, description, OG). Upload `apex-logo-trans.png` as a Lovable asset.
2. **Enable Lovable Cloud** (Supabase) and run the initial migration covering only what Phase 1 uses:
   - `profiles` (linked to `auth.users`, with `recruiting_slug`, `role`, `team_id`, `manager_id`)
   - `app_role` enum + `user_roles` + `has_role()` security-definer
   - `teams`
   - `applicant_sources`
   - `pipeline_stages` (seeded with the 11 default stages)
   - `applicants` (single source of truth per spec)
   - `applicant_activities`
   - `evaluations`
   - `system_settings` (Calendly URL, sender info)
   - GRANTs + RLS: public can INSERT into `applicants` and `evaluations` via a `SECURITY DEFINER` server function only; nobody except staff can SELECT.
3. **Public routes** built as React components from `APEX Financial.dc.html`:
   - `/` landing (nav, hero, VSL slot, why APEX, process, earnings, benefits, testimonials, FAQ, CTA, footer)
   - `/apply` full application form with zod validation, reads `?ref=` slug, shows referring recruiter's name
   - `/schedule` — greets by first name, embeds Calendly URL from `system_settings`
   - `/evaluation` — questionnaire keyed by email
   - `/application-complete` — confirmation
   - `/login` — Supabase email/password (used by Phase 2)
4. **Server functions** (`createServerFn`, no auth middleware, use publishable server client + narrow `TO anon` INSERT policies routed through `SECURITY DEFINER` RPC):
   - `submitApplication` — resolves recruiter by slug, inserts applicant at `New Applicant` stage, logs activity, returns applicant id
   - `submitEvaluation` — matches most recent applicant by email, stores answers, logs activity; preserves record if no match
5. **Emails**: wire the two uploaded templates into the Lovable email scaffold (welcome + evaluation-request). Trigger welcome on application submit. Sender = "APEX Financial Hiring", reply-to = `kjvaughns13@gmail.com`, stored in `system_settings`.
6. **Deliverable**: public site is live, applicant funnel works end-to-end, data is queryable in Supabase, styling matches the uploaded design.

## Phase 2 — Auth, portal shell, agent dashboard, applicant CRM & profile

- Real Supabase auth (login, forgot password, reset, sign out, session).
- Roles: `agent | manager | admin | super_admin` in `user_roles`; helper policies via `has_role`.
- `_authenticated/route.tsx` gate (integration-managed). Portal layout: fixed sidebar desktop, collapsible tablet, bottom-nav mobile — translated from `APEX Agent Portal.dc.html`.
- `/portal` dashboard cards + widgets, all reading from Supabase.
- `/portal/applicants` CRM (search, filters, table+card views, pagination, CSV export, manual create, reassign).
- `/portal/applicants/:id` profile with tabs (Overview / Activity / Notes / Appointments / Tasks / Documents / Licensing / Application / Evaluation).
- RLS: agents see only their assignments; managers see their team; admins see all.

## Phase 3 — Pipeline, tasks, calendar

- Drag-and-drop Kanban at `/portal/pipeline` writing stage transitions + activity events.
- Tasks table + `/portal/tasks` (list / day / week, overdue filter).
- Calendar at `/portal/calendar` (day/week/month) surfacing appointments + tasks; structure ready for Calendly webhook + Google Calendar sync (route stub at `/api/public/webhooks/calendly`).

## Phase 4 — Leaderboard, reports, resources

- `/portal/leaderboard` with aggregated metrics only; RLS + a `SECURITY DEFINER` aggregate function so agents can't read peers' applicant rows.
- `/portal/reports` with the 11 report views, filters, CSV export, dark charts w/ gold accents (Recharts).
- `/portal/resources` published resources for agents; categories per spec.

## Phase 5 — Admin portal & system settings

- `/admin/*` routes (dashboard, applicants, users, teams, pipeline config, sources, resources, reports, settings), all gated by `has_role('admin')` / `has_role('super_admin')`.
- Pipeline stage CRUD, source CRUD, resource CRUD, user invite + role assignment (super_admin only), team management.
- Calendly URL, email sender info, and other tunables editable via `/admin/settings` → `system_settings`.

## Phase 6 — Demo data, responsive QA, cleanup

- Seed migration for demo agents/managers/teams/applicants/activities (marked `is_demo=true`), matching the sample data shown in the uploads.
- Desktop / tablet / mobile pass on every route.
- Remove any remaining prototype scaffolding, static demo values in dashboard, and duplicate nav.

## Technical notes

- Stack stays TanStack Start + React + TS + Tailwind v4 + Supabase (Lovable Cloud). No new framework.
- Single `applicants` table — no split between "application" and "applicant".
- Public writes go through `SECURITY DEFINER` RPCs called from unauthenticated `createServerFn`s; no broad anon INSERT policies on `applicants`.
- Authenticated server fns use `requireSupabaseAuth`; admin operations verify role via `has_role` in `context.supabase` before importing `supabaseAdmin`.
- Calendly webhook: `src/routes/api/public/webhooks/calendly.ts` with signature verification, stubbed until you provide the signing secret.
- Emails via the Lovable managed email API; no queue or cron table.
- Recruiter attribution stored on `applicants.original_recruiter_id` and never overwritten by reassignment (`assigned_recruiter_id` moves independently).

## One decision I need from you before starting Phase 1

Do you want me to proceed strictly phase-by-phase (approve after each), or should I roll Phases 1–2 together in the first build so you can log in and see the portal shell right away? Phase 1 alone still gives a working public funnel; Phases 1+2 is roughly 2× the surface area in one shot.
