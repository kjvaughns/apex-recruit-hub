import { useState } from "react";

export type AddAgentFields = { full_name: string; email: string; phone: string };

/**
 * Fast 3-field "Add Agent" modal. The parent owns what happens on submit
 * (Phase 2 wires it to the addAgent server fn); this component only collects
 * the fields and manages its own submitting/error state.
 */
export function AddAgentModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (fields: AddAgentFields) => Promise<void>;
}) {
  const [f, setF] = useState<AddAgentFields>({ full_name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof AddAgentFields, v: string) => setF((p) => ({ ...p, [k]: v }));

  const valid =
    f.full_name.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()) &&
    f.phone.replace(/\D/g, "").length >= 7;

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        full_name: f.full_name.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
      });
    } catch (e) {
      setError((e as Error).message || "Could not add agent.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="apx-card my-16 w-full max-w-[460px] p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-[26px] leading-none">Add agent</h2>
        <p className="mt-2 text-[13px] text-apex-muted">
          Send a new licensed agent straight into onboarding. They'll get a portal invite and their
          4-step checklist.
        </p>

        <div className="mt-5 grid gap-4">
          <R label="Full name *">
            <input
              className="apx-input"
              value={f.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              autoFocus
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
          <R label="Phone *">
            <input
              type="tel"
              className="apx-input"
              value={f.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </R>

          {error && (
            <div className="rounded-[10px] border border-red-500/30 bg-red-500/10 p-3 text-[13px] text-red-200">
              {error}
            </div>
          )}

          <div className="mt-1 flex gap-3">
            <button onClick={onClose} className="apx-btn-ghost flex-1 px-4 py-3 text-[13.5px]">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!valid || submitting}
              className="apx-btn-primary flex-1 px-4 py-3 text-[13.5px] disabled:opacity-60"
            >
              {submitting ? "Sending invite…" : "Add agent & send invite"}
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
