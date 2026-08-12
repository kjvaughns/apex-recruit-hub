# New agents get a register screen, not a login wall

## What's happening

When an applicant is moved to Onboarding, the welcome email's button points at
`/portal/onboarding`. That page is behind the portal gate, so a brand-new agent
with no account gets bounced to the sign-in screen.

The account-setup screen already exists (`/portal-invite/<token>` — prefilled
name, email, phone, state, password, NPN), and one code path already creates a
single-use invitation token. Two gaps:

1. The onboarding email's main button uses the generic onboarding link, so the
   invitation link that was generated never gets used.
2. Only one of the ways an applicant can reach Onboarding (manual stage change
   from the applicant record) creates the invitation at all. Pipeline drag,
   automations, and other paths send the email with no token.

## The fix

1. Move invitation creation into the stage engine, so *every* path that moves
   someone to Onboarding does the same thing: if the applicant has no portal
   account yet, reuse their pending invitation or create one, then point the
   email's button at `/portal-invite/<token>`. If they already have an account,
   the button keeps going to the portal/login as it does today.
2. On the register screen, make NPN required for invited agents (they're
   licensed by the time they hit onboarding) and keep the rest of their info
   prefilled from the invitation. Show name and email read-only for context so
   it's obvious the account is theirs.
3. Add a short line on the sign-in page for anyone who lands there by mistake:
   invited agents should use the setup link in their email, with a way to ask
   their recruiter to resend it.

After setup, the new agent is signed in and dropped straight on their
onboarding checklist (already the current behaviour).

## Technical notes

- `src/lib/recruiting/stage-engine.server.ts`: in `applyStage`, when
  `stage === "onboarding"`, resolve the portal link (pending invitation →
  `create_invitation` RPC with `applicant_id`) and inject
  `onboarding_link` / `invitation_link` / `portal_link` into the email context
  before `sendApplicantEmail`. Explicit `args.context` values still win.
- `src/lib/portal.functions.ts`: drop the now-duplicated
  `resolveOnboardingPortalLink` call from `updateApplicantStage` (engine owns it);
  keep the helper only where the standalone welcome-onboarding queue uses it.
- `src/routes/portal-invite/$token.tsx`: NPN required (not gated behind the
  licensed toggle), read-only name/email summary, unchanged submit flow.
- `src/routes/login.tsx`: add invited-agent helper copy.
- No schema changes; `invitations.applicant_id` and `create_invitation` already
  support this.
