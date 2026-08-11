// Email delivery. Sends through Lovable's managed email API and records the
// outcome in the email_outbox log (status = sent | failed | skipped) so
// managers can inspect what went out. Best-effort: a delivery failure never
// breaks an application submission or an auto-hire.

import { render, resolveLinks, type TemplateKey, type TemplateParams } from "./templates";

type MinimalClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

/** Recruiting agent who should receive a copy of an applicant email. */
export type EmailCopyTarget = { email?: string | null; name?: string | null };

export type QueueEmailArgs = {
  to: string;
  toName?: string;
  applicantId?: string | null;
  template: TemplateKey;
  params?: Omit<TemplateParams, "links">;
  /** Recruiting agent copied on this email (rendered with a "your copy" banner). */
  copyTo?: EmailCopyTarget | null;
  /** Name shown in the agent's copy banner. Defaults to the recipient's name. */
  copyForName?: string | null;
};

/** Internal template key -> registered React Email template name. */
const TEMPLATE_NAMES: Record<TemplateKey, string> = {
  application_licensed: "application-licensed",
  application_unlicensed: "application-unlicensed",
  welcome_hired: "welcome-hired",
  followup_checkin: "followup-checkin",
  welcome_onboarding: "welcome-onboarding",
  onboarding_complete: "onboarding-complete",
};

/** Log a send outcome to the outbox. Never throws. */
async function logOutbox(
  supabase: MinimalClient,
  payload: Record<string, unknown>,
  label: string,
): Promise<void> {
  try {
    const { error } = await supabase.rpc("enqueue_email", { payload });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn(`[email] outbox log failed for ${label}:`, error);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[email] unexpected error logging ${label}:`, e);
  }
}

type SendOutcome = { status: "sent" | "failed" | "skipped"; error: string | null };

/** Fire one registered template at one address. Never throws. */
async function deliver(
  templateName: string,
  email: string,
  templateData: Record<string, unknown>,
  idempotencyKey: string,
): Promise<SendOutcome> {
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail(templateName, email, { templateData, idempotencyKey });
    return { status: result.sent ? "sent" : "skipped", error: result.sent ? null : result.reason };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.warn(`[email] send failed for ${templateName} -> ${email}:`, msg);
    return { status: "failed", error: msg };
  }
}

/**
 * Send a branded Vantage email and log the outcome. When `copyTo` names a
 * recruiting agent, the same email is delivered to them with a banner marking
 * it as their copy. Never throws into the caller's flow.
 */
export async function queueEmail(
  supabase: MinimalClient,
  { to, toName, applicantId, template, params, copyTo, copyForName }: QueueEmailArgs,
): Promise<void> {
  const email = to?.trim().toLowerCase();
  if (!email) return;

  const links = resolveLinks();
  const rendered = render(template, { ...params, links });
  const templateName = TEMPLATE_NAMES[template];
  const templateData = {
    firstName: params?.firstName,
    licensed: params?.licensed,
    portalLink: params?.portalLink,
    ...links,
  };

  const primary = await deliver(
    templateName,
    email,
    templateData,
    `${template}-${applicantId ?? email}`,
  );

  await logOutbox(
    supabase,
    {
      to_email: email,
      to_name: toName ?? null,
      subject: rendered.subject,
      html: rendered.html,
      template_key: template,
      applicant_id: applicantId ?? null,
      status: primary.status,
      error: primary.error,
    },
    `${template} -> ${email}`,
  );

  // Recruiting agent's copy — same content, banner naming the applicant.
  const agentEmail = copyTo?.email?.trim().toLowerCase();
  if (!agentEmail || agentEmail === email) return;

  const copyFor = (copyForName ?? toName ?? params?.firstName ?? email)?.toString().trim();
  const copy = await deliver(
    templateName,
    agentEmail,
    { ...templateData, firstName: firstNameFrom(copyTo?.name), copyFor },
    `${template}-copy-${applicantId ?? email}`,
  );

  await logOutbox(
    supabase,
    {
      to_email: agentEmail,
      to_name: copyTo?.name ?? null,
      subject: `Copy: ${rendered.subject}`,
      html: rendered.html,
      template_key: `${template}_agent_copy`,
      applicant_id: applicantId ?? null,
      status: copy.status,
      error: copy.error,
    },
    `${template} copy -> ${agentEmail}`,
  );
}

/** Details rendered in the agent's new-applicant alert. */
export type AgentApplicantAlert = {
  agentEmail?: string | null;
  agentName?: string | null;
  applicantId?: string | null;
  applicantName?: string;
  applicantEmail?: string;
  applicantPhone?: string;
  state?: string;
  licensed?: boolean;
  instagramHandle?: string;
  whyText?: string;
  /** Pre-formatted schedule line (CT slot, 1:1 request, or not scheduled). */
  scheduleLabel?: string;
  referredByName?: string;
  applicantUrl?: string;
};

/**
 * Notify the recruiting agent that a new applicant landed under them.
 * Best-effort — never throws into the submission flow.
 */
export async function sendAgentNewApplicant(
  supabase: MinimalClient,
  alert: AgentApplicantAlert,
): Promise<void> {
  const agentEmail = alert.agentEmail?.trim().toLowerCase();
  if (!agentEmail) return;

  const templateData: Record<string, unknown> = {
    agentName: firstNameFrom(alert.agentName),
    applicantName: alert.applicantName,
    applicantEmail: alert.applicantEmail,
    applicantPhone: alert.applicantPhone,
    state: alert.state,
    licensed: !!alert.licensed,
    instagramHandle: alert.instagramHandle,
    whyText: alert.whyText,
    scheduleLabel: alert.scheduleLabel,
    referredByName: alert.referredByName,
    applicantUrl: alert.applicantUrl,
  };

  const outcome = await deliver(
    "agent-new-applicant",
    agentEmail,
    templateData,
    `agent-new-applicant-${alert.applicantId ?? alert.applicantEmail ?? agentEmail}`,
  );

  await logOutbox(
    supabase,
    {
      to_email: agentEmail,
      to_name: alert.agentName ?? null,
      subject: `New applicant: ${alert.applicantName || "someone just applied"}`,
      html: "",
      template_key: "agent_new_applicant",
      applicant_id: alert.applicantId ?? null,
      status: outcome.status,
      error: outcome.error,
    },
    `agent_new_applicant -> ${agentEmail}`,
  );
}


export function firstNameFrom(fullName?: string | null, fallback?: string | null): string {
  const n = (fullName ?? "").trim();
  if (n) return n.split(/\s+/)[0];
  return (fallback ?? "").trim();
}
