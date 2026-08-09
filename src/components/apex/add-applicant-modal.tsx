import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAssignableRecruiters, createApplicantManual } from "@/lib/portal.functions";

export function AddApplicantModal({
  defaultStageId,
  onClose,
  onCreated,
}: {
  defaultStageId?: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const ctxFn = useServerFn(getAssignableRecruiters);
  const createFn = useServerFn(createApplicantManual);
  const ctxQ = useQuery({ queryKey: ["assignable"], queryFn: () => ctxFn() });

  const [f, setF] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    state: "",
    licensed: false,
    instagram_handle: "",
    assigned_recruiter_id: "",
    referred_by_profile_id: "",
    team_id: "",
    source_id: "",
    stage_id: defaultStageId ?? "",
    priority: "normal" as "low" | "normal" | "high",
    next_follow_up_at: "",
    notes: "",
    why_text: "",
  });
  const [error, setError] = useState("");
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const ctx = ctxQ.data;
  const assigned = f.assigned_recruiter_id || ctx?.defaultRecruiterId || "";

  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          ...f,
          state: f.state.toUpperCase(),
          assigned_recruiter_id: assigned,
          next_follow_up_at: f.next_follow_up_at ? new Date(f.next_follow_up_at).toISOString() : "",
        } as any,
      }),
    onSuccess: (res: { id: string }) => onCreated(res.id),
    onError: (e: unknown) => setError((e as Error).message || "Could not add applicant."),
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="apx-card my-8 w-full max-w-[640px] p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-[26px] leading-none">Add applicant</h2>
        <p className="mt-2 text-[13px] text-apex-muted">
          Manually add an applicant to your CRM and pipeline.
        </p>

        <div className="mt-5 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <R label="First name *">
              <input
                className="apx-input"
                value={f.first_name}
                onChange={(e) => set("first_name", e.target.value)}
              />
            </R>
            <R label="Last name *">
              <input
                className="apx-input"
                value={f.last_name}
                onChange={(e) => set("last_name", e.target.value)}
              />
            </R>
            <R label="Email *">
              <input
                type="email"
                className="apx-input"
                value={f.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </R>
            <R label="Phone">
              <input
                type="tel"
                className="apx-input"
                value={f.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </R>
            <R label="State">
              <input
                className="apx-input"
                maxLength={2}
                value={f.state}
                onChange={(e) => set("state", e.target.value)}
              />
            </R>
            <R label="Instagram">
              <input
                className="apx-input"
                value={f.instagram_handle}
                onChange={(e) => set("instagram_handle", e.target.value)}
              />
            </R>
            <R label="Assign to *">
              <select
                className="apx-input"
                value={assigned}
                onChange={(e) => set("assigned_recruiter_id", e.target.value)}
              >
                {(ctx?.recruiters ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </R>
            <R label="Referring recruiter">
              <select
                className="apx-input"
                value={f.referred_by_profile_id}
                onChange={(e) => set("referred_by_profile_id", e.target.value)}
              >
                <option value="">— same as assigned —</option>
                {(ctx?.recruiters ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </R>
            <R label="Team">
              <select
                className="apx-input"
                value={f.team_id}
                onChange={(e) => set("team_id", e.target.value)}
              >
                <option value="">— none —</option>
                {(ctx?.teams ?? []).map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </R>
            <R label="Source">
              <select
                className="apx-input"
                value={f.source_id}
                onChange={(e) => set("source_id", e.target.value)}
              >
                <option value="">— default —</option>
                {(ctx?.sources ?? []).map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </R>
            <R label="Pipeline stage">
              <select
                className="apx-input"
                value={f.stage_id}
                onChange={(e) => set("stage_id", e.target.value)}
              >
                <option value="">New Applicant (default)</option>
                {(ctx?.stages ?? []).map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </R>
            <R label="Priority">
              <select
                className="apx-input"
                value={f.priority}
                onChange={(e) => set("priority", e.target.value)}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </R>
            <R label="Next follow-up">
              <input
                type="date"
                className="apx-input"
                value={f.next_follow_up_at}
                onChange={(e) => set("next_follow_up_at", e.target.value)}
              />
            </R>
          </div>
          <R label="Why they want to work with Vantage">
            <textarea
              className="apx-input"
              rows={2}
              value={f.why_text}
              onChange={(e) => set("why_text", e.target.value)}
            />
          </R>
          <R label="Notes">
            <textarea
              className="apx-input"
              rows={2}
              value={f.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </R>

          {error && (
            <div className="rounded-[10px] border border-red-500/30 bg-red-500/10 p-3 text-[13px] text-red-200">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} className="apx-btn-ghost flex-1 px-4 py-3 text-[13.5px]">
              Cancel
            </button>
            <button
              onClick={() => mut.mutate()}
              disabled={
                mut.isPending ||
                !f.first_name.trim() ||
                !f.last_name.trim() ||
                !f.email.trim() ||
                !assigned
              }
              className="apx-btn-primary flex-1 px-4 py-3 text-[13.5px] disabled:opacity-60"
            >
              {mut.isPending ? "Adding…" : "Add applicant"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function R({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-apex-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
