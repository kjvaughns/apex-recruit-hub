## Apply pending SQL migrations

Eight migration files exist in `supabase/migrations/` that have not yet been executed against the database. The DB currently has 14 tables and is missing the hierarchy fields, invitations, stage history, audit log, and related functions defined in these files.

### Migrations to apply (in order)

1. `20260724120000_recruiter_attribution.sql` — recruiter slugs, `can_receive_applicants`, safe public recruiter search RPC (may be partially applied; will run idempotently).
2. `20260724130000_add_leader_role.sql` — adds `leader` value to `app_role` enum (must run alone so the new enum is committed before later migrations reference it).
3. `20260724130100_hierarchy_foundation.sql` — Admin > Manager > Leader > Agent hierarchy columns, helpers, RLS updates.
4. `20260724130200_invitations.sql` — `invitations` table + RPCs for invite/accept flow.
5. `20260724130300_promote_applicant.sql` — RPC to promote an applicant to an invited agent.
6. `20260724130400_stage_history.sql` — `applicant_stage_history` table + trigger.
7. `20260724130500_company_leaderboard.sql` — company-wide leaderboard SECURITY DEFINER RPCs.
8. `20260724130600_audit_and_resources.sql` — `audit_log` table + resource authorship/publish fields.

### Execution approach

Because migration #2 adds an enum value that later migrations reference, it must be committed before #3–#8 run. I will submit them as **two separate `supabase--migration` calls**:

- Call A: files #1 and #2 concatenated (enum add is the final statement so it commits before the next batch).
- Call B: files #3 through #8 concatenated in order.

Each call goes through the standard approval + auto-run flow. After both are applied I will run `supabase--linter` and address any warnings tied to these migrations.

### Notes / risks

- All files use `IF NOT EXISTS` / `CREATE OR REPLACE` patterns where I spot-checked, so re-running the already-partially-applied recruiter attribution file should be safe.
- No application code changes are needed in this step — the code already references these tables/RPCs (`invitations.functions.ts`, `audit.ts`, stage history, leaderboard).
- No data is dropped; these are additive schema changes.