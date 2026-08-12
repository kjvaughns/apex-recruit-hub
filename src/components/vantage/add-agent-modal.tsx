import { useState } from "react";
import { Modal, Field, Input, Button } from "@/components/portal/ui";

export type AddAgentFields = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
};

/**
 * Fast 4-field "Add Agent" modal. The parent owns what happens on submit
 * (Phase 2 wires it to the addAgent server fn); this component only collects
 * the fields and manages its own submitting/error state.
 */
export function AddAgentModal({
  onClose,
  onSubmit,
  inviteLink,
}: {
  onClose: () => void;
  onSubmit: (fields: AddAgentFields) => Promise<void>;
  /** Shareable self-registration link (…/join/<slug>), when available. */
  inviteLink?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [f, setF] = useState<AddAgentFields>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof AddAgentFields, v: string) => setF((p) => ({ ...p, [k]: v }));

  const valid =
    f.first_name.trim().length > 0 &&
    f.last_name.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()) &&
    f.phone.replace(/\D/g, "").length >= 7;

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
      });
    } catch (e) {
      setError((e as Error).message || "Could not add agent.");
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Add agent"
      description="Send a new licensed agent straight into onboarding. They'll get a portal invite and their 4-step checklist."
      onClose={onClose}
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid || submitting}>
            {submitting ? "Sending invite…" : "Add agent & send invite"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {inviteLink && (
          <div
            className="grid gap-2 rounded-[10px] border p-3"
            style={{ borderColor: "var(--p-border)", background: "var(--p-surface-2)" }}
          >
            <div className="text-[13px] font-medium">Or share your invite link</div>
            <p className="text-[12px] opacity-70">
              Anyone with this link registers themselves as a new agent under you and lands in
              onboarding.
            </p>
            <div className="flex items-center gap-2">
              <Input value={inviteLink} readOnly onFocus={(e) => e.currentTarget.select()} />
              <Button
                variant="ghost"
                onClick={() => {
                  navigator.clipboard?.writeText(inviteLink);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <Input
              value={f.first_name}
              onChange={(e) => set("first_name", e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Last name" required>
            <Input
              value={f.last_name}
              onChange={(e) => set("last_name", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Email" required>
          <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Phone" required>
          <Input type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>

        {error && (
          <div
            className="rounded-[10px] border px-3 py-2 text-[13px]"
            style={{ borderColor: "var(--p-red)", background: "rgba(220,106,98,0.1)", color: "var(--p-red)" }}
          >
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}

