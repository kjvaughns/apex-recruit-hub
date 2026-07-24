// Best-effort audit logging helper. Takes an authenticated Supabase client
// (from requireSupabaseAuth) and writes a row to public.audit_logs. Failures
// never block the primary action.
export type AuditEntry = {
  action: string;
  actor_id: string;
  target_user_id?: string | null;
  target_applicant_id?: string | null;
  previous_value?: unknown;
  new_value?: unknown;
  metadata?: unknown;
};

export async function writeAudit(supabase: unknown, e: AuditEntry): Promise<void> {
  try {
    await (supabase as any).from("audit_logs").insert({
      action: e.action,
      actor_id: e.actor_id,
      target_user_id: e.target_user_id ?? null,
      target_applicant_id: e.target_applicant_id ?? null,
      previous_value: e.previous_value ?? null,
      new_value: e.new_value ?? null,
      metadata: e.metadata ?? null,
    });
  } catch {
    /* audit is best-effort */
  }
}
