// Shared recruiting vocabulary — kept in one place so the CRM, pipeline, and
// leaderboard stay consistent. The authoritative pipeline stages live in the
// `pipeline_stages` table; these constants cover the applicant recruiting-status
// set (a jsonb-free enum-ish column) and a reference stage order for the client.

import type { BadgeTone } from "@/components/portal/ui";

/** Recruiting decision/condition — independent of pipeline stage. */
export const RECRUITING_STATUSES = [
  "pending",
  "hired",
  "follow_up",
  "no_show",
  "not_interested",
  "not_qualified",
  "declined",
  "inactive",
  "terminated",
] as const;
export type RecruitingStatus = (typeof RECRUITING_STATUSES)[number];

export const RECRUITING_STATUS_LABELS: Record<RecruitingStatus, string> = {
  pending: "Pending",
  hired: "Hired",
  follow_up: "Follow Up",
  no_show: "No Show",
  not_interested: "Not Interested",
  not_qualified: "Not Qualified",
  declined: "Declined",
  inactive: "Inactive",
  terminated: "Terminated",
};

/** Badge tone for each status, matching the portal UI kit tones. */
export const RECRUITING_STATUS_TONE: Record<RecruitingStatus, BadgeTone> = {
  pending: "neutral",
  hired: "green",
  follow_up: "amber",
  no_show: "red",
  not_interested: "red",
  not_qualified: "red",
  declined: "red",
  inactive: "neutral",
  terminated: "red",
};

export function recruitingStatusLabel(value: string | null | undefined): string {
  if (value && value in RECRUITING_STATUS_LABELS) {
    return RECRUITING_STATUS_LABELS[value as RecruitingStatus];
  }
  return "Pending";
}

export function recruitingStatusTone(value: string | null | undefined): BadgeTone {
  if (value && value in RECRUITING_STATUS_TONE) {
    return RECRUITING_STATUS_TONE[value as RecruitingStatus];
  }
  return "neutral";
}

/**
 * Target pipeline stage slugs in display order. The DB is authoritative for the
 * actual rows/ids; this is a reference for ordering and typing on the client.
 */
export const PIPELINE_STAGE_SLUGS = [
  "new-applicant",
  "interview-scheduled",
  "interview-completed",
  "pre-licensing",
  "state-exam",
  "licensing",
  "onboarding",
  "training",
  "active-agent", // displayed as "Active"
  "not-moving-forward", // displayed as "Terminated"
] as const;
export type PipelineStageSlug = (typeof PIPELINE_STAGE_SLUGS)[number];
