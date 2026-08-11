// Email delivery. Sends through Lovable's managed email API and records the
// outcome in the email_outbox log (status = sent | failed | skipped) so
// managers can inspect what went out. Best-effort: a delivery failure never
// breaks an application submission or an auto-hire.

import { render, resolveLinks, type TemplateKey, type TemplateParams } from "./templates";

type MinimalClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

export type QueueEmailArgs = {
  to: string;
  toName?: string;
  applicantId?: string | null;
  template: TemplateKey;
  params?: Omit<TemplateParams, "links">;
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

/**
 * Send a branded Vantage email and log the outcome. Never throws into the
 * caller's flow.
 */
export async function queueEmail(
  supabase: MinimalClient,
  { to, toName, applicantId, template, params }: QueueEmailArgs,
): Promise<void> {
  const email = to?.trim();
  if (!email) return;

  const links = resolveLinks();
  const rendered = render(template, { ...params, links });

  let status: "sent" | "failed" | "skipped" = "failed";
  let errorText: string | null = null;

  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail(TEMPLATE_NAMES[template], email, {
      templateData: {
        firstName: params?.firstName,
        licensed: params?.licensed,
        portalLink: params?.portalLink,
        ...links,
      },
      idempotencyKey: `${template}-${applicantId ?? email}`,
    });
    status = result.sent ? "sent" : "skipped";
    if (!result.sent) errorText = result.reason;
  } catch (e) {
    errorText = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.warn(`[email] send failed for ${template} -> ${email}:`, errorText);
  }

  try {
    const { error } = await supabase.rpc("enqueue_email", {
      payload: {
        to_email: email,
        to_name: toName ?? null,
        subject: rendered.subject,
        html: rendered.html,
        template_key: template,
        applicant_id: applicantId ?? null,
        status,
        error: errorText,
      },
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn(`[email] outbox log failed for ${template} -> ${email}:`, error);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[email] unexpected error logging ${template}:`, e);
  }
}

export function firstNameFrom(fullName?: string | null, fallback?: string | null): string {
  const n = (fullName ?? "").trim();
  if (n) return n.split(/\s+/)[0];
  return (fallback ?? "").trim();
}
