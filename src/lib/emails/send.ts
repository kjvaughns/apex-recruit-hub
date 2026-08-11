// Phase 3 — stub "send". No transactional provider is wired yet: we render the
// template and enqueue it into email_outbox (status='pending') via the
// enqueue_email RPC, and log a line so the trigger is observable. When a
// provider is added later, it drains pending rows — nothing here needs to move.

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

/**
 * Render a template and enqueue it as a pending outbox row. Best-effort:
 * never throws into the caller's flow — a queue failure must not break an
 * application submission or an auto-hire.
 */
export async function queueEmail(
  supabase: MinimalClient,
  { to, toName, applicantId, template, params }: QueueEmailArgs,
): Promise<void> {
  try {
    const email = to?.trim();
    if (!email) return;
    const rendered = render(template, { ...params, links: resolveLinks() });
    const { error } = await supabase.rpc("enqueue_email", {
      payload: {
        to_email: email,
        to_name: toName ?? null,
        subject: rendered.subject,
        html: rendered.html,
        template_key: template,
        applicant_id: applicantId ?? null,
      },
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn(`[email:stub] enqueue failed for ${template} -> ${email}:`, error);
      return;
    }
    // eslint-disable-next-line no-console
    console.log(`[email:stub] queued ${template} -> ${email} (no provider; pending in outbox)`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[email:stub] unexpected error queuing ${template}:`, e);
  }
}

export function firstNameFrom(fullName?: string | null, fallback?: string | null): string {
  const n = (fullName ?? "").trim();
  if (n) return n.split(/\s+/)[0];
  return (fallback ?? "").trim();
}
