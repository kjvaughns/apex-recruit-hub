import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import { getApplicant, updateApplicantStage, addApplicantNote } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/portal/crm/$applicantId")({
  head: () => ({ meta: [{ title: "Applicant — APEX Portal" }, { name: "robots", content: "noindex" }] }),
  component: ApplicantDetailPage,
});

function ApplicantDetailPage() {
  const { applicantId } = Route.useParams();
  const qc = useQueryClient();
  const fetchOne = useServerFn(getApplicant);
  const changeStage = useServerFn(updateApplicantStage);
  const addNote = useServerFn(addApplicantNote);

  const { data, isLoading } = useQuery({
    queryKey: ["applicant", applicantId],
    queryFn: () => fetchOne({ data: { id: applicantId } }),
  });

  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function onStage(stageId: string) {
    await changeStage({ data: { id: applicantId, stage_id: stageId } });
    qc.invalidateQueries({ queryKey: ["applicant", applicantId] });
    qc.invalidateQueries({ queryKey: ["applicants"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function onAddNote() {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await addNote({ data: { id: applicantId, note: note.trim() } });
      setNote("");
      qc.invalidateQueries({ queryKey: ["applicant", applicantId] });
    } finally {
      setSaving(false);
    }
  }

  const a = data?.applicant;
  const currentStage = data?.stages.find((s) => s.id === a?.current_stage_id);

  return (
    <PortalShell>
      <PortalHeader
        kicker="CRM › Applicant"
        title={isLoading || !a ? "Loading…" : `${a.first_name} ${a.last_name}`}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/portal/crm" className="apx-btn-ghost px-3 py-2 text-[12.5px]">← Back to CRM</Link>
            {currentStage && (
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold"
                style={{ borderColor: `${currentStage.color}55`, background: `${currentStage.color}18`, color: currentStage.color }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: currentStage.color }} />
                {currentStage.name}
              </span>
            )}
          </div>
        }
      />

      {isLoading || !a ? (
        <div className="p-10 text-[13px] text-apex-faint">Loading applicant…</div>
      ) : (
        <div className="grid gap-6 px-6 py-8 md:px-10 xl:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-6">
            <div className="apx-card p-6">
              <h2 className="mb-4 font-display text-[20px] leading-none">Contact</h2>
              <dl className="grid gap-3 text-[13.5px] md:grid-cols-2">
                <Field label="Email" value={a.email} />
                <Field label="Phone" value={a.phone ?? "—"} />
                <Field label="Location" value={[a.city, a.state, a.zip].filter(Boolean).join(", ") || "—"} />
                <Field label="Date of birth" value={a.date_of_birth ?? "—"} />
                <Field label="Licensed" value={a.licensed ? "Yes" : "No"} />
                <Field label="Priority" value={a.priority} />
                <Field label="Status" value={a.status} />
                <Field label="Created" value={new Date(a.created_at).toLocaleString()} />
              </dl>
              {a.why_text && (
                <div className="mt-6">
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-apex-faint">Why APEX</div>
                  <p className="text-[14px] leading-relaxed text-apex-fog whitespace-pre-wrap">{a.why_text}</p>
                </div>
              )}
            </div>

            <div className="apx-card p-6">
              <h2 className="mb-4 font-display text-[20px] leading-none">Move to stage</h2>
              <div className="flex flex-wrap gap-2">
                {(data?.stages ?? []).map((s) => {
                  const active = s.id === a.current_stage_id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => onStage(s.id)}
                      disabled={active}
                      className="rounded-full border px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-100"
                      style={{
                        borderColor: active ? s.color : "rgba(255,255,255,0.1)",
                        background: active ? `${s.color}22` : "transparent",
                        color: active ? s.color : "#C9C7C0",
                      }}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {(data?.evaluations ?? []).length > 0 && (
              <div className="apx-card p-6">
                <h2 className="mb-4 font-display text-[20px] leading-none">Evaluation</h2>
                {data!.evaluations.map((ev) => (
                  <div key={ev.id} className="grid gap-2 text-[13.5px] md:grid-cols-2">
                    {Object.entries((ev.answers as Record<string, string>) ?? {}).map(([k, v]) => (
                      <div key={k} className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-3">
                        <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-apex-faint">{k}</div>
                        <div className="text-apex-fog">{v}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <div className="apx-card p-6">
              <h2 className="mb-3 font-display text-[20px] leading-none">Add a note</h2>
              <textarea
                className="apx-input"
                rows={4}
                placeholder="What happened on the last touchpoint?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                onClick={onAddNote}
                disabled={saving || !note.trim()}
                className="apx-btn-primary mt-3 w-full px-4 py-3 text-[13.5px] disabled:opacity-60"
              >
                {saving ? "Saving…" : "Add note"}
              </button>
            </div>

            <div className="apx-card p-6">
              <h2 className="mb-4 font-display text-[20px] leading-none">Timeline</h2>
              <div className="flex flex-col gap-3">
                {(data?.activities ?? []).map((act) => (
                  <div key={act.id} className="border-b border-white/[0.05] pb-3 last:border-0">
                    <div className="text-[12.5px] text-apex-gold">{eventLabel(act.event_type)}</div>
                    {act.summary && <div className="mt-1 text-[13.5px] text-apex-fog">{act.summary}</div>}
                    <div className="mt-1 text-[11px] text-apex-faint">{new Date(act.created_at).toLocaleString()}</div>
                  </div>
                ))}
                {(data?.activities ?? []).length === 0 && (
                  <div className="text-[12.5px] text-apex-faint">No activity yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-apex-faint">{label}</div>
      <div className="text-apex-fog">{value}</div>
    </div>
  );
}

function eventLabel(t: string) {
  const map: Record<string, string> = {
    application_submitted: "Application submitted",
    evaluation_submitted: "Evaluation submitted",
    appointment_scheduled: "Appointment scheduled",
    stage_changed: "Stage changed",
    note: "Note",
  };
  return map[t] ?? t.replace(/_/g, " ");
}
