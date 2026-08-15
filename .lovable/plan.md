# Update Vantage Onboarding Flow

Rework the agent onboarding checklist to the Agent Cloud setup and new Discord process, keeping it a sequential, progress-saving checklist with the same five-step structure.

## New step 1: Agent Cloud Onboarding

Replaces the AgentSpace/SureLC contracting step (title, copy, agency code, and training-video block all removed).

- Instructions: create an Agent Cloud account using the Vantage invite link `https://useagentcloud.com/invite/dcee6766-4b8f-44c0-9f4c-025ccdcbce2e`.
- Buttons: **Create Agent Cloud Account** (opens invite in a new tab) and **I Created My Agent Cloud Account** to complete the step.
- Shows **Your Upline: [Leader Name]**, resolved from the live organization hierarchy (the agent's nearest leader above them), never hardcoded. If none can be resolved, show a fallback: contact your recruiter before continuing.
- Shows the agent's stored details to copy over instead of retyping: full name, email, phone, NPN. Anything missing in the portal is shown as "add during setup".

## New step 2: Update Discord Role

- New invite: `https://discord.gg/sFgEEPRSmw` (old invite removed).
- Instructions: join the Vantage Discord if not already in, go to **Start Here**, select **Licensed**; the licensed agent channels then unlock. All "New App"/register-through-the-old-flow wording removed.
- Buttons: **Open Discord** and **I've Updated My Discord Role**.

## Step 3: Agent Playbook

- Resolve the published Agent Playbook from the Academy Library at view time rather than the hardcoded `agent-playbook` slug, so the button keeps working if the record changes.
- Button **Open Agent Playbook** links to that resolved resource; **I Have Read the Playbook** completes the step.
- If no playbook resource is found, agents see a "not available yet — contact your recruiter" note and admins see a configuration warning.

## Step 4: Expectations & Schedule

Unchanged: all meeting times, training/film-review schedule, live-dial expectations, production standards, attendance and communication expectations, and the acknowledgement checkbox stay exactly as they are, fully expandable including Super Admin preview mode.

## Step 5: Vantage Closer Course

- Resolve the existing published Vantage Closer Course from Academy → Courses (no duplicate created); button **Start Vantage Closer Course** deep-links to it.
- Already auto-completes when the Academy course is finished; the manual check stays only as a fallback and the step notes that finishing the course completes it automatically.
- If the course is missing or unpublished, agents see a neutral note and admins see a configuration warning instead of a broken link.

## Completion

Existing behavior is kept and the wording is updated: on the fifth step the record is marked complete, the completion date is stamped, the applicant moves to the **Training** stage, the Training Start email fires, and the recruiter/trainer is notified. The panel reads **Onboarding Complete — You're ready for Vantage New Agent Training.**

## Cleanup

Remove the AgentSpace agency code and URL, the SureLC/contracting video block, the old Discord invite and New App instructions, and the "completed AgentSpace contracting" wording in the recruiter notification email. The onboarding-step list in the welcome email is updated to Agent Cloud onboarding, Discord licensed role, Agent Playbook, expectations & schedule, Vantage Closer Course.

## Technical notes

- Step keys in `src/lib/onboarding.ts` stay the same shape but the first key is renamed to `agent_cloud_onboarding` (order and labels updated) — this needs a small migration to rename the key inside the `onboarding_steps` jsonb on existing applicant rows and inside the `update_onboarding` RPC's allowed-step list, so saved progress is preserved. `completeOnboardingStep`'s zod enum and `notifyOnboarding`'s `contracting_done` copy update accordingly.
- A new server function in `src/lib/portal.functions.ts` returns the onboarding page's contextual data: the agent's nearest upline (walk `profiles.parent_user_id` upward to the first profile with a leader/manager/admin role, falling back to the assigned recruiter), the agent's prefill fields (full name, email, phone, NPN), the playbook library resource slug, and the Closer Course slug plus published flag.
- `src/routes/_authenticated/portal/onboarding.tsx` consumes that data; step render functions become data-aware instead of static, so preview mode still renders every step body.
- No changes to Academy content, course progress logic, or the stage engine beyond wording.
