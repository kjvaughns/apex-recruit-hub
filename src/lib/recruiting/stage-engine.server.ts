/**
 * The single stage engine for the Vantage recruiting journey.
 *
 * Every stage change — recruiter action, Calendly webhook, evaluation,
 * course-purchase link, onboarding completion — goes through `applyStage`.
 * It writes the stage, keeps status/stamps in sync, logs a timeline entry,
 * fires the stage email (with the recruiting agent's copy), and starts or
 * stops the automated sequences that belong to that stage.
 *
 * Server-only.
 */

import { randomBytes } from "crypto";

import { emailLinks, SITE_URL } from "@/lib/email/links";
import { formatDate, formatTime, formatWhen, type EmailContext } from "@/lib/email/vars";
import type { RecruitingStatus } from "@/lib/recruiting";

export type StageSlug =
  | "new-applicant"
  | "interview-scheduled"
  | "interview-completed"
  | "pre-licensing"
  | "state-exam"
  | "licensing"
  | "onboarding"
  | "training"
  | "active-agent"
  | "not-moving-forward";

export type SequenceKind =
  | "interview_reminders"
  | "exam_reminders"
  | "no_show_followup";

/** Email fired when an applicant lands on a stage. */
export const STAGE_EMAIL: Partial<Record<StageSlug, string>> = {
  "interview-scheduled": "interview-confirmation",
  "interview-completed": "accepted",
  "pre-licensing": "pre-licensing",
  "state-exam": "state-exam-scheduled",
  licensing: "licensing-next-steps",
  onboarding: "welcome-onboarding",
  training: "training-instructions",
  "active-agent": "active-agent",
  "not-moving-forward": "not-moving-forward",
};

/** Stamp column set when the applicant enters a stage. */
const STAGE_STAMP: Partial<Record<StageSlug, string>> = {
  "interview-completed": "hired_at",
  "pre-licensing": "pre_licensing_at",
  licensing: "licensing_at",
  training: "training_started_at",
};

/** Status forced by entering a stage (others keep the recruiter's status). */
const STAGE_STATUS: Partial<Record<StageSlug, RecruitingStatus>> = {
  "interview-completed": "hired",
  "not-moving-forward": "terminated",
};

export const STAGE_LABELS: Record<StageSlug, string> = {
  "new-applicant": "New Applicant",
  "interview-scheduled": "Interview Scheduled",
  "interview-completed": "Interview Completed",
  "pre-licensing": "Pre Licensing",
  "state-exam": "State Exam",
  licensing: "Licensing",
  onboarding: "Onboarding",
  training: "Training",
  "active-agent": "Active",
  "not-moving-forward": "Terminated",
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export interface ApplicantRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  licensed: boolean | null;
  state: string | null;
  resident_state: string | null;
  npn: string | null;
  recruiting_status: string | null;
  current_stage_id: string | null;
  assigned_recruiter_id: string | null;
  original_recruiter_id: string | null;
  scheduled_event_start: string | null;
  scheduled_event_url: string | null;
  calendly_scheduled_at: string | null;
  requested_overview_at: string | null;
  exam_date: string | null;
  exam_provider: string | null;
  confirmation_token: string | null;
  portal_profile_id: string | null;
}

const APPLICANT_COLS =
  "id, first_name, last_name, email, phone, licensed, state, resident_state, npn, recruiting_status, current_stage_id, assigned_recruiter_id, original_recruiter_id, scheduled_event_start, scheduled_event_url, calendly_scheduled_at, requested_overview_at, exam_date, exam_provider, confirmation_token, portal_profile_id";

/**
 * Account-setup link for an applicant entering Onboarding. New agents have no
 * portal account yet, so every path into Onboarding must hand them a
 * single-use invitation link instead of a login wall. Existing accounts keep
 * going to the portal. Never throws.
 */
async function onboardingAccountLink(a: ApplicantRow): Promise<string> {
  if (a.portal_profile_id) return `${SITE_URL}/login`;
  if (!a.email) return `${SITE_URL}/login`;
  try {
    const supabase = await db();
    const { data: inv } = await supabase
      .from("invitations")
      .select("token")
      .eq("applicant_id", a.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let token: string | undefined = inv?.token;
    if (!token) {
      const { data: res } = await supabase.rpc("create_invitation", {
        payload: {
          email: a.email,
          first_name: a.first_name ?? "",
          last_name: a.last_name ?? "",
          phone: a.phone ?? "",
          state: a.resident_state ?? a.state ?? "",
          licensed: true,
          npn: a.npn ?? "",
          role: "agent",
          applicant_id: a.id,
        },
      });
      token = res?.token;
    }
    if (token) return `${SITE_URL}/portal-invite/${token}`;
  } catch (e) {
    console.warn("[recruiting] onboarding invite link failed:", (e as Error).message);
  }
  return `${SITE_URL}/login`;
}



export async function loadApplicant(applicantId: string): Promise<ApplicantRow | null> {
  const supabase = await db();
  const { data } = await supabase
    .from("applicants")
    .select(APPLICANT_COLS)
    .eq("id", applicantId)
    .maybeSingle();
  return (data as ApplicantRow) ?? null;
}

/** Matches by email first, then phone (digits only), newest record wins. */
export async function findApplicant(
  email?: string | null,
  phone?: string | null,
): Promise<ApplicantRow | null> {
  const supabase = await db();
  if (email?.trim()) {
    const { data } = await supabase
      .from("applicants")
      .select(APPLICANT_COLS)
      .ilike("email", email.trim())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as ApplicantRow;
  }
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length >= 7) {
    const tail = digits.slice(-7);
    const { data } = await supabase
      .from("applicants")
      .select(APPLICANT_COLS)
      .ilike("phone", `%${tail}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as ApplicantRow;
  }
  return null;
}

export async function stageIdBySlug(slug: StageSlug): Promise<string | null> {
  const supabase = await db();
  const { data } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return data?.id ?? null;
}

export async function stageSlugById(id: string | null): Promise<StageSlug | null> {
  if (!id) return null;
  const supabase = await db();
  const { data } = await supabase
    .from("pipeline_stages")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  return (data?.slug as StageSlug) ?? null;
}

export async function logActivity(
  applicantId: string,
  eventType: string,
  summary: string,
  data: Record<string, unknown> = {},
  actorId?: string | null,
): Promise<void> {
  try {
    const supabase = await db();
    await supabase.from("applicant_activities").insert({
      applicant_id: applicantId,
      actor_id: actorId ?? null,
      event_type: eventType,
      summary,
      data,
    });
  } catch (e) {
    console.warn("[recruiting] activity log failed:", e);
  }
}

/* ------------------------------------------------------------------ */
/* Secure applicant action links                                       */
/* ------------------------------------------------------------------ */

export async function createActionToken(
  applicantId: string,
  action: string,
  days = 120,
): Promise<string> {
  const supabase = await db();
  // Reuse an unused, unexpired token so repeated emails carry one link.
  const { data: existing } = await supabase
    .from("applicant_action_tokens")
    .select("token, expires_at, used_at")
    .eq("applicant_id", applicantId)
    .eq("action", action)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.token) return existing.token as string;

  const token = randomBytes(24).toString("base64url");
  await supabase.from("applicant_action_tokens").insert({
    applicant_id: applicantId,
    action,
    token,
    expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
  });
  return token;
}

export type ClaimResult =
  | { ok: true; applicantId: string; firstClaim: boolean }
  | { ok: false; reason: "invalid" | "expired" };

/** Single-use claim. A second click reports `firstClaim: false`, not an error. */
export async function claimActionToken(token: string, action: string): Promise<ClaimResult> {
  const supabase = await db();
  const { data: row } = await supabase
    .from("applicant_action_tokens")
    .select("id, applicant_id, expires_at, used_at")
    .eq("token", token)
    .eq("action", action)
    .maybeSingle();
  if (!row) return { ok: false, reason: "invalid" };
  if (row.used_at) return { ok: true, applicantId: row.applicant_id, firstClaim: false };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };

  const { data: claimed } = await supabase
    .from("applicant_action_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();
  return { ok: true, applicantId: row.applicant_id, firstClaim: !!claimed };
}

/* ------------------------------------------------------------------ */
/* Sequences                                                           */
/* ------------------------------------------------------------------ */

/** Hours before the appointment for each interview reminder touch. */
export const INTERVIEW_TOUCH_HOURS = [144, 96, 48, 24];
/** Hours before the exam for each exam reminder touch. */
export const EXAM_TOUCH_HOURS = [72, 24, 6];
/** Hours after the miss for each no-show follow-up touch. */
export const NO_SHOW_TOUCH_HOURS = [0, 48, 96];

function nextInterviewSend(anchorIso: string, touch: number): string | null {
  const anchor = new Date(anchorIso).getTime();
  for (let i = touch; i < INTERVIEW_TOUCH_HOURS.length; i++) {
    const at = anchor - INTERVIEW_TOUCH_HOURS[i] * 3600_000;
    if (at > Date.now()) return new Date(at).toISOString();
  }
  return null;
}

function nextExamSend(anchorIso: string, touch: number): string | null {
  const anchor = new Date(anchorIso).getTime();
  for (let i = touch; i < EXAM_TOUCH_HOURS.length; i++) {
    const at = anchor - EXAM_TOUCH_HOURS[i] * 3600_000;
    if (at > Date.now()) return new Date(at).toISOString();
  }
  return null;
}

/** Next due time for a sequence, or null when it has nothing left to send. */
export function sequenceNextSend(
  kind: SequenceKind,
  anchorIso: string,
  touch: number,
): string | null {
  if (kind === "interview_reminders") return nextInterviewSend(anchorIso, touch);
  if (kind === "exam_reminders") return nextExamSend(anchorIso, touch);
  if (touch >= NO_SHOW_TOUCH_HOURS.length) return null;
  return new Date(new Date(anchorIso).getTime() + NO_SHOW_TOUCH_HOURS[touch] * 3600_000).toISOString();
}

export async function startSequence(
  applicantId: string,
  kind: SequenceKind,
  anchorIso: string,
): Promise<void> {
  const next = sequenceNextSend(kind, anchorIso, 0);
  const supabase = await db();
  await supabase.from("applicant_sequences").upsert(
    {
      applicant_id: applicantId,
      kind,
      status: next ? "active" : "done",
      touch_count: 0,
      anchor_at: anchorIso,
      next_send_at: next,
      stop_reason: null,
    },
    { onConflict: "applicant_id,kind" },
  );
}

export async function stopSequence(
  applicantId: string,
  kind: SequenceKind,
  reason: string,
): Promise<void> {
  const supabase = await db();
  await supabase
    .from("applicant_sequences")
    .update({ status: "stopped", next_send_at: null, stop_reason: reason })
    .eq("applicant_id", applicantId)
    .eq("kind", kind)
    .eq("status", "active");
}

export async function stopAllSequences(applicantId: string, reason: string): Promise<void> {
  const supabase = await db();
  await supabase
    .from("applicant_sequences")
    .update({ status: "stopped", next_send_at: null, stop_reason: reason })
    .eq("applicant_id", applicantId)
    .eq("status", "active");
}

/* ------------------------------------------------------------------ */
/* Email context                                                       */
/* ------------------------------------------------------------------ */

export interface RecruiterInfo {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  one_on_one_calendly_url?: string | null;
  licensed_calendly_url?: string | null;
}

export async function loadRecruiter(a: ApplicantRow): Promise<RecruiterInfo | null> {
  const id = a.assigned_recruiter_id ?? a.original_recruiter_id;
  if (!id) return null;
  const supabase = await db();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, one_on_one_calendly_url, licensed_calendly_url")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.full_name ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    one_on_one_calendly_url: data.one_on_one_calendly_url ?? null,
    licensed_calendly_url: data.licensed_calendly_url ?? null,
  };
}

async function settingValue(key: string): Promise<string | null> {
  try {
    const supabase = await db();
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    const v = (data?.value ?? "").trim();
    return v || null;
  } catch {
    return null;
  }
}

/** Full variable context for any applicant email. */
export async function applicantContext(
  a: ApplicantRow,
  extra: EmailContext = {},
): Promise<EmailContext> {
  const recruiter = await loadRecruiter(a);
  const interviewAt = a.scheduled_event_start ?? a.calendly_scheduled_at ?? a.requested_overview_at;
  const rescheduleUrl =
    a.scheduled_event_url ??
    recruiter?.one_on_one_calendly_url ??
    recruiter?.licensed_calendly_url ??
    `${SITE_URL}/schedule`;
  const cheatSheet = await settingValue("licensing_cheat_sheet_url");
  const courseToken = await createActionToken(a.id, "course_purchased");

  return {
    ...emailLinks(),
    first_name: a.first_name ?? undefined,
    last_name: a.last_name ?? undefined,
    full_name: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || undefined,
    applicant_name: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || undefined,
    email: a.email ?? undefined,
    phone: a.phone ?? undefined,
    state: a.resident_state ?? a.state ?? undefined,
    recruiter_name: recruiter?.name ?? undefined,
    recruiter_email: recruiter?.email ?? undefined,
    recruiter_phone: recruiter?.phone ?? undefined,
    interview_date: formatDate(interviewAt) ?? undefined,
    interview_time: formatTime(interviewAt) ?? undefined,
    interview_when: formatWhen(interviewAt) ?? undefined,
    overview_date: formatDate(interviewAt) ?? undefined,
    overview_time: formatTime(interviewAt) ?? undefined,
    overview_when: formatWhen(interviewAt) ?? undefined,
    reschedule_link: rescheduleUrl,
    one_on_one_link: recruiter?.one_on_one_calendly_url ?? `${SITE_URL}/schedule`,
    exam_date: formatDate(a.exam_date) ?? undefined,
    exam_time: formatTime(a.exam_date) ?? undefined,
    exam_when: formatWhen(a.exam_date) ?? undefined,
    exam_provider: a.exam_provider ?? undefined,
    course_confirm_link: `${SITE_URL}/course-purchased/${courseToken}`,
    cheat_sheet_link: cheatSheet ?? undefined,
    instagram_link: "https://instagram.com/vantage.financial",
    ...extra,
  } as EmailContext;
}

/** Send an applicant email. Recruiters are notified separately on stage moves. */
export async function sendApplicantEmail(
  a: ApplicantRow,
  template: string,
  opts: { context?: EmailContext; sendKey?: string; actorId?: string | null } = {},
): Promise<void> {
  if (!a.email) return;
  const { sendEmail } = await import("@/lib/email/dispatch.server");
  const context = await applicantContext(a, opts.context ?? {});
  await sendEmail({
    template,
    to: a.email,
    toName: context.full_name ?? undefined,
    applicantId: a.id,
    context,
    sendKey: opts.sendKey ?? null,
    sentBy: opts.actorId ?? null,
    automated: !opts.actorId,
  });
}

/**
 * Tell the recruiting agent one of their applicants moved forward. Sent once
 * per applicant per stage; preference-gated like every other agent email.
 */
export async function notifyRecruiterStage(
  a: ApplicantRow,
  to: StageSlug,
  from: StageSlug | null,
): Promise<void> {
  const recruiter = await loadRecruiter(a);
  if (!recruiter?.email) return;
  if (recruiter.email.trim().toLowerCase() === (a.email ?? "").trim().toLowerCase()) return;

  const { sendEmail } = await import("@/lib/email/dispatch.server");
  const applicantName = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || a.email || "Your applicant";
  await sendEmail({
    template: "agent-applicant-stage",
    to: recruiter.email,
    toName: recruiter.name,
    profileId: recruiter.id,
    applicantId: a.id,
    sendKey: `stage-alert:${a.id}:${to}`,
    context: {
      ...emailLinks({ portal_link: `${SITE_URL}/portal/crm/${a.id}` }),
      first_name: (recruiter.name ?? "").trim().split(/\s+/)[0] || "there",
      applicant_name: applicantName,
      stage_name: STAGE_LABELS[to],
      previous_stage: from ? STAGE_LABELS[from] : "their previous stage",
    },
  });
}

/* ------------------------------------------------------------------ */
/* applyStage                                                          */
/* ------------------------------------------------------------------ */

export interface ApplyStageArgs {
  applicantId: string;
  stage: StageSlug;
  actorId?: string | null;
  reason?: string | null;
  /** Extra applicant columns to write in the same update. */
  patch?: Record<string, unknown>;
  /** Skip the stage email (e.g. the caller sends a richer one itself). */
  skipEmail?: boolean;
  /** Extra email variables for the stage email. */
  context?: EmailContext;
  /** Dedupe suffix for the stage email. */
  sendKey?: string | null;
}

export interface ApplyStageResult {
  ok: boolean;
  changed: boolean;
  from: StageSlug | null;
  to: StageSlug;
}

export async function applyStage(args: ApplyStageArgs): Promise<ApplyStageResult> {
  const supabase = await db();
  const applicant = await loadApplicant(args.applicantId);
  if (!applicant) return { ok: false, changed: false, from: null, to: args.stage };

  const fromSlug = await stageSlugById(applicant.current_stage_id);
  const stageId = await stageIdBySlug(args.stage);
  const changed = fromSlug !== args.stage;
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = { ...(args.patch ?? {}) };
  if (stageId && changed) {
    patch.current_stage_id = stageId;
    patch.stage_entered_at = now;
  }
  const status = STAGE_STATUS[args.stage];
  if (status && applicant.recruiting_status !== "terminated") patch.recruiting_status = status;
  const stamp = STAGE_STAMP[args.stage];
  if (stamp && changed) patch[stamp] = now;
  // Reaching onboarding (or beyond) means they're licensed.
  if (["onboarding", "training", "active-agent"].includes(args.stage) && !applicant.licensed) {
    patch.licensed = true;
    if (!("licensing_status" in patch)) patch.licensing_status = "licensed";
  }


  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("applicants").update(patch).eq("id", args.applicantId);
    if (error) {
      console.warn("[recruiting] stage update failed:", error.message);
      return { ok: false, changed: false, from: fromSlug, to: args.stage };
    }
  }

  if (changed) {
    await logActivity(
      args.applicantId,
      "stage_changed",
      `Stage → ${STAGE_LABELS[args.stage]}`,
      { from: fromSlug, to: args.stage, reason: args.reason ?? null },
      args.actorId,
    );
  }

  // Sequences that must stop when the journey moves on.
  if (["interview-completed", "pre-licensing", "state-exam", "licensing", "onboarding", "training", "active-agent"].includes(args.stage)) {
    await stopSequence(args.applicantId, "interview_reminders", `stage:${args.stage}`);
    await stopSequence(args.applicantId, "no_show_followup", `stage:${args.stage}`);
  }
  if (args.stage === "not-moving-forward") {
    await stopAllSequences(args.applicantId, "terminated");
  }
  if (["licensing", "onboarding", "training", "active-agent"].includes(args.stage)) {
    await stopSequence(args.applicantId, "exam_reminders", `stage:${args.stage}`);
  }

  const fresh = (await loadApplicant(args.applicantId)) ?? applicant;

  // Sequences that start on arrival.
  if (args.stage === "interview-scheduled") {
    const anchor = fresh.scheduled_event_start ?? fresh.calendly_scheduled_at ?? fresh.requested_overview_at;
    if (anchor) await startSequence(args.applicantId, "interview_reminders", anchor);
  }
  if (args.stage === "state-exam" && fresh.exam_date) {
    await startSequence(args.applicantId, "exam_reminders", fresh.exam_date);
  }

  const template = STAGE_EMAIL[args.stage];
  if (changed && template && !args.skipEmail) {
    await sendApplicantEmail(fresh, template, {
      context: args.context,
      sendKey: args.sendKey ?? `stage:${args.stage}:${args.applicantId}`,
      actorId: args.actorId ?? null,
    });
  }

  // The recruiting agent gets their own notification on every real move.
  if (changed) await notifyRecruiterStage(fresh, args.stage, fromSlug);

  return { ok: true, changed, from: fromSlug, to: args.stage };
}
