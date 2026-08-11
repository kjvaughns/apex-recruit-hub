// Shared onboarding step definitions + progress helper. Used by the CRM
// indicator, the onboarding page, and server functions so the 4 canonical
// steps and their labels stay in one place.

export type OnboardingStepKey =
  | "agentspace_contracting"
  | "discord_role_update"
  | "portal_account_setup"
  | "expectations_reviewed"
  | "complete_vantage_closer_course";

export const ONBOARDING_STEP_ORDER: OnboardingStepKey[] = [
  "agentspace_contracting",
  "discord_role_update",
  "portal_account_setup",
  "expectations_reviewed",
  "complete_vantage_closer_course",
];

export const ONBOARDING_STEP_LABELS: Record<OnboardingStepKey, string> = {
  agentspace_contracting: "AgentSpace contracting",
  discord_role_update: "Discord role update",
  portal_account_setup: "Portal account setup",
  expectations_reviewed: "Expectations reviewed",
  complete_vantage_closer_course: "Complete the Vantage Closer Course",
};

// The steps an agent self-checks (portal_account_setup is automatic).
export const SELF_CHECK_STEPS: OnboardingStepKey[] = [
  "agentspace_contracting",
  "discord_role_update",
  "expectations_reviewed",
  "complete_vantage_closer_course",
];

export type OnboardingStepState = { completed: boolean; completed_at: string | null };
export type OnboardingSteps = Record<OnboardingStepKey, OnboardingStepState>;

/** Canonical freshly-initialized steps (all false). */
export function initialOnboardingSteps(): OnboardingSteps {
  return {
    agentspace_contracting: { completed: false, completed_at: null },
    discord_role_update: { completed: false, completed_at: null },
    portal_account_setup: { completed: false, completed_at: null },
    expectations_reviewed: { completed: false, completed_at: null },
    complete_vantage_closer_course: { completed: false, completed_at: null },
  };
}

/** Count completed steps from a possibly-missing/loosely-typed jsonb value. */
export function onboardingProgress(steps: unknown): { done: number; total: number } {
  const total = ONBOARDING_STEP_ORDER.length;
  if (!steps || typeof steps !== "object") return { done: 0, total };
  const s = steps as Record<string, { completed?: boolean } | undefined>;
  const done = ONBOARDING_STEP_ORDER.filter((k) => s[k]?.completed === true).length;
  return { done, total };
}
