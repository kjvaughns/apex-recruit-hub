import type { RecruiterOption } from "@/lib/applications.functions";

// Referral attribution captured when a visitor lands via an agent's referral
// link. Persisted in sessionStorage so it survives navigation + refresh within
// the recruiting session, and is read back when the applicant reaches /apply.
export type ReferralAttribution = {
  slug: string;
  recruiter: RecruiterOption | null; // resolved active recruiter, or null if invalid
  landing_url: string;
  invalid: boolean; // slug was present but did not resolve to an active recruiter
};

const KEY = "apex_referral";

export function saveReferral(a: ReferralAttribution): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function getReferral(): ReferralAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ReferralAttribution) : null;
  } catch {
    return null;
  }
}

export function clearReferral(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
