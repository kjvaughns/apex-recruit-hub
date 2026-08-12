# Show the full onboarding checklist, not a condensed preview

## What's happening now

On the onboarding page, only one step is shown in full detail at a time. In the preview view (accounts without an active checklist, like yours) just the first step is expanded — the other four collapse to a one-line summary, so all the detail you laid out (AgentSpace instructions and agency code, Discord role steps, playbook link, the full weekly schedule and standards list, Closer Course) stays hidden.

## The change

- In preview mode, render every step fully expanded so the complete checklist content is visible top to bottom.
- In the live agent view, keep the current step highlighted and expanded, but let any step be opened: each step header becomes clickable to expand/collapse its detail, so completed and upcoming steps can be read in full too.
- Add a small "Expand all / Collapse all" control above the list.
- No changes to step data, completion logic, progress math, or the backend — this is presentation only.

## Technical notes

All in `src/routes/_authenticated/portal/onboarding.tsx`:
- `StepRow`'s `expanded` currently derives from `status === "current" || (preview && n === 1)`. Replace with controlled state owned by `StepChecklist` (a set of open step keys), defaulting to all keys open when `preview`, and to the current step when live.
- Header row gets a button/toggle affordance (chevron) and keyboard accessibility; completion buttons remain gated to the current step as today.
