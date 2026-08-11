# Apply the five pending backend updates

The recent commits shipped portal code (Onboarding module, expanded Settings, Academy LMS) whose database changes were written but never applied. The live database currently has none of them, so those pages read columns, tables, and functions that don't exist yet.

Confirmed against the live database: no `courses` / `course_modules` / `course_lessons` / `enrollments` tables exist, `applicants` has no `onboarding_steps` or `onboarding_completed_at`, and `profiles` has no `notification_prefs`.

## What gets applied, in order

1. **Onboarding stage + data model** — adds an "Onboarding" pipeline stage between Contracting and Training, per-applicant onboarding step progress, a completion timestamp, and a trigger that initializes the 4 canonical steps the moment an applicant reaches that stage.
2. **Agent self-service onboarding updates** — a guarded function so an onboarding agent can check off their own steps (and only their own), stamping completion once so the "Onboarding Complete" email can only fire a single time.
3. **Expanded settings** — per-agent notification preferences stored durably, plus a public-read `avatars` storage bucket where each user can only write inside their own folder (backs profile-photo upload).
4. **Academy LMS schema** — courses, modules, lessons, enrollments, and progress with access rules so agents see published content and admins manage it.
5. **Vantage Onboarding course** — seeds the Required "Vantage Onboarding" course inside Academy and adds an enrollment helper so an agent is enrolled when they reach the Onboarding stage.

Each file is applied verbatim from `supabase/migrations/` (`20260811160000_onboarding_stage`, `20260811170000_onboarding_updates`, `20260811180000_settings`, `20260812120000_academy`, `20260812130000_academy_onboarding`) as five separate migrations, in timestamp order, since the later ones depend on the earlier ones.

## After applying

- Regenerated database types land automatically; then verify typecheck and build pass.
- Spot-check the affected portal routes (Onboarding, Settings, Academy) for any code that was written ahead of the schema and needs a small fix now that the columns exist.
- No data backfill: existing applicants get their onboarding steps initialized the first time they land on the Onboarding stage.
