# Apply the six remaining database updates

I checked the live database against the migration files in the repo. The six newest updates were written but never applied — confirmed directly:

- Pipeline stages still show the old flow (Attempting Contact, Contacted, Pre-Contracting, Contracting all active; no Pre Licensing or State Exam).
- Applicants have no NPN, resident state, or recruiting status fields.
- Evaluations have no internal score field.
- Library resources have no "section" field (Presentations vs Library).
- The retired "Vantage Onboarding" course still exists.
- The company leaderboard has no Hires column.

## What gets applied, in order

Each file is applied verbatim as its own migration, in timestamp order, since later ones build on earlier ones.

1. **Onboarding checklist step** (`20260813000000_onboarding_closer_step.sql`) — retires the duplicate "Vantage Onboarding" Academy course, adds a 5th self-check step pointing agents to the Vantage Closer Course, and backfills existing onboarding records so already-finished agents aren't reopened.
2. **Recruiting data model** (`20260814000000_recruiting_data_model.sql`) — restructures the pipeline into the target flow (adds Pre Licensing and State Exam, renames/reorders the kept stages, archives the retired ones) and adds NPN, resident state, and recruiting status to applicant and agent records.
3. **Evaluation v2** (`20260815000000_evaluation_v2.sql`) — the evaluation now moves a matched applicant to Interview Completed, marks them hired, stamps evaluation/hire timestamps once, and stores an internal 0–100 guidance score (never auto-approves or rejects). Retires the Contracting stage, rolling its applicants to Onboarding.
4. **Onboarding steps v2** (`20260816000000_onboarding_steps_v2.sql`) — drops the automatic "portal account setup" step (that now happens before onboarding) and adds "read the agent playbook" and "agent expectations & schedule".
5. **Academy sections** (`20260817000000_academy_sections.sql`) — splits Academy content into Recorded Presentations vs Library with optional simple categories, and promotes existing recorded trainings into the Presentations section.
6. **Leaderboard hires** (`20260818000000_leaderboard_hires.sql`) — adds a Hires count to the company leaderboard.

## After applying

- Database types regenerate automatically; then verify typecheck and build pass.
- Spot-check the pages these touch — Pipeline, Applicants/CRM, Onboarding, Academy hub, Leaderboard — and fix any code written ahead of the schema (for example leaderboard code that now receives a hires count, or Academy queries that need to filter by section).
- Run the security linter afterwards and address anything these migrations introduce.
