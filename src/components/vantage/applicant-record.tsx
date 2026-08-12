import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getApplicant,
  updateApplicant,
  updateApplicantStage,
  addApplicantNote,
  logApplicantActivity,
  setOverviewStatus,
  sendFollowUpEmail,
  setDiscordConfirmed,
  listAssignableUsers,
} from "@/lib/portal.functions";
import { getInvitableContext, promoteApplicantToAgent } from "@/lib/invitations.functions";
import {
  onboardingProgress,
  ONBOARDING_STEP_ORDER,
  ONBOARDING_STEP_LABELS,
} from "@/lib/onboarding";
import {
  RECRUITING_STATUSES,
  RECRUITING_STATUS_LABELS,
  recruitingStatusLabel,
  recruitingStatusTone,
} from "@/lib/recruiting";
import {
  Panel,
  Button,
  Badge,
  Textarea,
  Select,
  Input,
  Field,
  Modal,
} from "@/components/portal/ui";

/* -------------------------------------------------------------------------- */
/* Manual activity types                                                      */
/* -------------------------------------------------------------------------- */

const ACTIVITY_TYPES: { value: string; label: string }[] = [
  { value: "called", label: "Called" },
  { value: "no_answer", label: "No Answer" },
  { value: "left_voicemail", label: "Left Voicemail" },
  { value: "text_sent", label: "Text Sent" },
  { value: "email_sent", label: "Email Sent" },
  { value: "spoke_with", label: "Spoke With Applicant" },
  { value: "interview_scheduled", label: "Interview Scheduled" },
  { value: "interview_completed", label: "Interview Completed" },
  { value: "follow_up_scheduled", label: "Follow Up Scheduled" },
  { value: "evaluation_completed", label: "Evaluation Completed" },
  { value: "licensing_update", label: "Licensing Update" },
  { value: "onboarding_started", label: "Onboarding Started" },
  { value: "training_started", label: "Training Started" },
  { value: "hired", label: "Hired" },
  { value: "terminated", label: "Terminated" },
  { value: "other", label: "Other" },
];

const EVENT_LABELS: Record<string, string> = {
  application_submitted: "Application submitted",
  evaluation_submitted: "Evaluation submitted",
  appointment_scheduled: "Appointment scheduled",
  overview_updated: "Overview updated",
  follow_up_sent: "Follow-up sent",
  discord_updated: "Discord confirmation",
  stage_changed: "Stage changed",
  record_updated: "Record updated",
  note: "Note",
  manual_applicant_created: "Applicant created",
  promoted_to_agent: "Promoted to agent",
  ...Object.fromEntries(ACTIVITY_TYPES.map((t) => [t.value, t.label])),
};
function eventLabel(t: string) {
  return EVENT_LABELS[t] ?? t.replace(/_/g, " ");
}

/* -------------------------------------------------------------------------- */
/* Datetime helpers (ISO <-> <input type=datetime-local>)                     */
/* -------------------------------------------------------------------------- */

function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* -------------------------------------------------------------------------- */
/* ApplicantRecord — shared by the drawer and the full page                   */
/* -------------------------------------------------------------------------- */

export function ApplicantRecord({
  applicantId,
  variant = "page",
  onClose,
}: {
  applicantId: string;
  variant?: "page" | "drawer";
  onClose?: () => void;
}) {
  const qc = useQueryClient();
  const fetchOne = useServerFn(getApplicant);
  const saveFn = useServerFn(updateApplicant);
  const changeStage = useServerFn(updateApplicantStage);
  const addNote = useServerFn(addApplicantNote);
  const setOverview = useServerFn(setOverviewStatus);
  const usersFn = useServerFn(listAssignableUsers);

  const { data, isLoading } = useQuery({
    queryKey: ["applicant", applicantId],
    queryFn: () => fetchOne({ data: { id: applicantId } }),
  });
  const usersQ = useQuery({ queryKey: ["assignable-users"], queryFn: () => usersFn() });

  const a = data?.applicant as any;
  const currentStage = data?.stages.find((s) => s.id === a?.current_stage_id);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["applicant", applicantId] });
    qc.invalidateQueries({ queryKey: ["applicants"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  async function save(patch: Record<string, unknown>) {
    try {
      await saveFn({ data: { id: applicantId, ...(patch as any) } });
      invalidate();
    } catch (e) {
      toast.error((e as Error).message || "Could not save.");
    }
  }

  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  async function onStage(stageId: string) {
    try {
      await changeStage({ data: { id: applicantId, stage_id: stageId } });
      invalidate();
    } catch (e) {
      toast.error((e as Error).message || "Could not change stage.");
    }
  }
  async function onOverview(field: "scheduled" | "completed", value: boolean) {
    await setOverview({ data: { id: applicantId, field, value } });
    invalidate();
  }
  async function onAddNote() {
    if (!note.trim()) return;
    setSavingNote(true);
    try {
      await addNote({ data: { id: applicantId, note: note.trim() } });
      setNote("");
      invalidate();
    } finally {
      setSavingNote(false);
    }
  }

  const Wrapper = variant === "drawer" ? DrawerShell : PageShell;

  if (isLoading || !a) {
    return (
      <Wrapper onClose={onClose} title="Loading…">
        <div className="p-body py-10 text-center">Loading applicant…</div>
      </Wrapper>
    );
  }

  const fullName = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || "Applicant";
  const followUp = a.next_follow_up_at ? new Date(a.next_follow_up_at) : null;

  return (
    <Wrapper
      onClose={onClose}
      title={fullName}
      headerRight={
        <>
          {a.portal_profile_id ? (
            <Badge tone="green">Portal active</Badge>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setPromoteOpen(true)}>
              {a.promoted_to_agent_at ? "Invitation pending" : "Promote to Agent"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* Stage + status header */}
        <div className="flex flex-wrap items-center gap-2">
          {currentStage && (
            <span
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold"
              style={{ background: `${currentStage.color}18`, color: currentStage.color }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: currentStage.color }} />
              {currentStage.name}
            </span>
          )}
          <Badge tone={recruitingStatusTone(a.recruiting_status)}>
            {recruitingStatusLabel(a.recruiting_status)}
          </Badge>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-1.5">
          <QuickAction href={a.phone ? `tel:${a.phone}` : undefined} label="Call" />
          <QuickAction href={a.phone ? `sms:${a.phone}` : undefined} label="Text" />
          <QuickAction
            href={a.email ? `mailto:${a.email}` : undefined}
            label="Send Email"
          />
          <Button variant="secondary" size="sm" onClick={() => setLogOpen(true)}>
            Log Activity
          </Button>
        </div>

        {/* Editable contact + licensing */}
        <Panel title="Contact & licensing">
          <div key={a.updated_at} className="grid gap-3 sm:grid-cols-2">
            <EditText label="First name" defaultValue={a.first_name ?? ""} onSave={(v) => save({ first_name: v })} />
            <EditText label="Last name" defaultValue={a.last_name ?? ""} onSave={(v) => save({ last_name: v })} />
            <EditText label="Email" type="email" defaultValue={a.email ?? ""} onSave={(v) => save({ email: v })} />
            <EditText label="Phone" defaultValue={a.phone ?? ""} onSave={(v) => save({ phone: v || null })} />
            <EditText label="City" defaultValue={a.city ?? ""} onSave={(v) => save({ city: v || null })} />
            <EditText label="Resident state" defaultValue={a.resident_state ?? a.state ?? ""} onSave={(v) => save({ resident_state: v || null })} />
            <EditText label="NPN" defaultValue={a.npn ?? ""} onSave={(v) => save({ npn: v || null })} />
            <EditText label="Licensing status" defaultValue={a.licensing_status ?? ""} onSave={(v) => save({ licensing_status: v || null })} />
            <EditSelectField label="Status" value={a.recruiting_status ?? "pending"} onChange={(v) => save({ recruiting_status: v })}>
              {RECRUITING_STATUSES.map((s) => (
                <option key={s} value={s}>{RECRUITING_STATUS_LABELS[s]}</option>
              ))}
            </EditSelectField>
            <EditSelectField label="Stage" value={a.current_stage_id ?? ""} onChange={(v) => onStage(v)}>
              {(data?.stages ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </EditSelectField>
            <EditSelectField
              label="Assigned recruiter"
              value={a.assigned_recruiter_id ?? ""}
              onChange={(v) => save({ assigned_recruiter_id: v || null })}
            >
              <option value="">— none —</option>
              {(usersQ.data?.users ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </EditSelectField>
            <EditDateTimeField
              label="Next follow-up"
              defaultValue={isoToLocalInput(a.next_follow_up_at)}
              onSave={(v) => save({ next_follow_up_at: localInputToIso(v) })}
            />
          </div>
          {a.why_text && (
            <div className="mt-4">
              <div className="p-label mb-1">Why Vantage</div>
              <p className="p-body leading-relaxed whitespace-pre-wrap">{a.why_text}</p>
            </div>
          )}
        </Panel>

        {/* Upcoming follow-up */}
        {followUp && (
          <Panel title="Upcoming follow-up">
            <div className="flex items-center gap-2">
              <Badge tone={followUp.getTime() < Date.now() ? "red" : "amber"}>
                {followUp.getTime() < Date.now() ? "Overdue" : "Scheduled"}
              </Badge>
              <span className="p-body">{followUp.toLocaleString()}</span>
            </div>
          </Panel>
        )}

        {/* Onboarding progress */}
        {currentStage?.slug === "onboarding" && (
          <OnboardingProgressCard steps={a.onboarding_steps} />
        )}

        {/* Overview meeting */}
        <Panel
          title="Overview meeting"
          description="Booking through Calendly updates this automatically; use these toggles for a manual booking."
        >
          <div className="flex flex-wrap gap-2">
            <OverviewToggle label="Scheduled" active={!!a.overview_scheduled_at} onToggle={(v) => onOverview("scheduled", v)} />
            <OverviewToggle label="Completed" active={!!a.overview_completed_at} onToggle={(v) => onOverview("completed", v)} />
          </div>
        </Panel>

        <SendEvaluationCard applicant={a} />

        {!a.licensed && a.hired_at && (
          <DiscordCard applicantId={applicantId} confirmed={!!a.discord_confirmed} onChange={invalidate} />
        )}

        <FollowUpCard applicantId={applicantId} onSent={invalidate} />

        {/* Evaluation results */}
        {(data?.evaluations ?? []).length > 0 && (
          <Panel title="Evaluation results">
            {data!.evaluations.map((ev: any) => (
              <div key={ev.id} className="grid gap-2 text-[13px] sm:grid-cols-2">
                {Object.entries((ev.answers as Record<string, any>) ?? {})
                  .filter(([k]) => !k.startsWith("_"))
                  .map(([k, v]) => (
                    <div key={k} className="rounded-[10px] border p-2.5" style={{ borderColor: "var(--p-border)", background: "var(--p-raised)" }}>
                      <div className="p-label mb-1">{k.replace(/_/g, " ")}</div>
                      <div className="p-body">{String(v)}</div>
                    </div>
                  ))}
              </div>
            ))}
          </Panel>
        )}

        {/* Add note */}
        <Panel title="Add a note">
          <Textarea
            rows={3}
            placeholder="What happened on the last touchpoint?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button variant="primary" className="mt-3 w-full" onClick={onAddNote} disabled={savingNote || !note.trim()}>
            {savingNote ? "Saving…" : "Add note"}
          </Button>
        </Panel>

        {/* Activity timeline */}
        <Panel
          title="Activity timeline"
          actions={<Button variant="secondary" size="sm" onClick={() => setLogOpen(true)}>Log activity</Button>}
        >
          <div className="flex flex-col gap-3">
            {(data?.activities ?? []).map((act: any) => (
              <div key={act.id} className="border-b pb-3 last:border-0" style={{ borderColor: "var(--p-border)" }}>
                <div className="p-secondary" style={{ color: "var(--p-gold)" }}>{eventLabel(act.event_type)}</div>
                {act.summary && <div className="p-body mt-1">{act.summary}</div>}
                {act.data?.notes && <div className="p-secondary mt-1 whitespace-pre-wrap">{act.data.notes}</div>}
                <div className="p-muted mt-1">{new Date(act.created_at).toLocaleString()}</div>
              </div>
            ))}
            {(data?.activities ?? []).length === 0 && <div className="p-muted">No activity yet.</div>}
          </div>
        </Panel>
      </div>

      {promoteOpen && (
        <PromoteModal applicant={a} onClose={() => setPromoteOpen(false)} onDone={invalidate} />
      )}
      {logOpen && (
        <LogActivityModal
          applicantId={applicantId}
          onClose={() => setLogOpen(false)}
          onLogged={() => {
            setLogOpen(false);
            invalidate();
          }}
        />
      )}
    </Wrapper>
  );
}

/* -------------------------------------------------------------------------- */
/* Shells                                                                     */
/* -------------------------------------------------------------------------- */

function DrawerShell({
  children,
  title,
  headerRight,
  onClose,
}: {
  children: React.ReactNode;
  title: string;
  headerRight?: React.ReactNode;
  onClose?: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="p-panel absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col"
        style={{ borderRadius: 0 }}
      >
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--p-border)" }}>
          <h2 className="p-section-title truncate">{title}</h2>
          <div className="flex shrink-0 items-center gap-2">
            {headerRight}
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-focus grid h-8 w-8 shrink-0 place-items-center rounded-md text-[15px] hover:bg-[var(--p-hover)]"
              style={{ color: "var(--p-text-2)" }}
            >
              ✕
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function PageShell({
  children,
  title,
  headerRight,
}: {
  children: React.ReactNode;
  title: string;
  headerRight?: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="mx-auto max-w-[820px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/portal/applicants">
            <Button variant="ghost" size="sm">← Back</Button>
          </Link>
          <h1 className="p-title">{title}</h1>
        </div>
        <div className="flex items-center gap-2">{headerRight}</div>
      </div>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Inline-edit fields                                                         */
/* -------------------------------------------------------------------------- */

function EditText({
  label,
  defaultValue,
  type = "text",
  onSave,
}: {
  label: string;
  defaultValue: string;
  type?: string;
  onSave: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type={type}
        defaultValue={defaultValue}
        onBlur={(e) => {
          const v = e.currentTarget.value.trim();
          if (v !== (defaultValue ?? "").trim()) onSave(v);
        }}
      />
    </Field>
  );
}

function EditSelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Field label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </Select>
    </Field>
  );
}

function EditDateTimeField({
  label,
  defaultValue,
  onSave,
}: {
  label: string;
  defaultValue: string;
  onSave: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="datetime-local"
        defaultValue={defaultValue}
        onBlur={(e) => {
          if (e.currentTarget.value !== defaultValue) onSave(e.currentTarget.value);
        }}
      />
    </Field>
  );
}

function QuickAction({ href, label }: { href?: string; label: string }) {
  if (!href) {
    return (
      <Button variant="secondary" size="sm" disabled>
        {label}
      </Button>
    );
  }
  return (
    <a href={href}>
      <Button variant="secondary" size="sm">{label}</Button>
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/* Log Activity modal                                                         */
/* -------------------------------------------------------------------------- */

function LogActivityModal({
  applicantId,
  onClose,
  onLogged,
}: {
  applicantId: string;
  onClose: () => void;
  onLogged: () => void;
}) {
  const logFn = useServerFn(logApplicantActivity);
  const [type, setType] = useState("called");
  const [occurredAt, setOccurredAt] = useState(isoToLocalInput(new Date().toISOString()));
  const [notes, setNotes] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");

  const isFollowUp = type === "follow_up_scheduled";

  const mut = useMutation({
    mutationFn: () =>
      logFn({
        data: {
          id: applicantId,
          type: type as any,
          notes: notes.trim() || undefined,
          occurred_at: localInputToIso(occurredAt) ?? undefined,
          follow_up_at: followUpAt ? localInputToIso(followUpAt) ?? undefined : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Activity logged.");
      onLogged();
    },
    onError: (e: unknown) => toast.error((e as Error).message || "Could not log activity."),
  });

  const canSubmit = !mut.isPending && (!isFollowUp || (!!followUpAt && !!notes.trim()));

  return (
    <Modal
      title="Log activity"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => mut.mutate()} disabled={!canSubmit}>
            {mut.isPending ? "Saving…" : "Log activity"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Date & time">
          <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
        </Field>
        {isFollowUp && (
          <Field label="Follow-up date & time" required>
            <Input type="datetime-local" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} />
          </Field>
        )}
        <Field label="Notes" required={isFollowUp}>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Details…" />
        </Field>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Ported sub-components (promote / overview / discord / follow-up / eval)     */
/* -------------------------------------------------------------------------- */

function PromoteModal({ applicant, onClose, onDone }: { applicant: any; onClose: () => void; onDone: () => void }) {
  const ctxFn = useServerFn(getInvitableContext);
  const promoteFn = useServerFn(promoteApplicantToAgent);
  const ctxQ = useQuery({ queryKey: ["invite", "context"], queryFn: () => ctxFn() });

  const [role, setRole] = useState<"agent" | "leader">("agent");
  const [parent, setParent] = useState("");
  const [team, setTeam] = useState("");
  const [email, setEmail] = useState(applicant.email ?? "");
  const [phone, setPhone] = useState(applicant.phone ?? "");
  const [licensed, setLicensed] = useState(!!applicant.licensed);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      promoteFn({
        data: {
          applicant_id: applicant.id,
          role,
          parent_user_id: parent || "",
          team_id: team || "",
          email: email.trim(),
          phone: phone.trim(),
          state: applicant.resident_state ?? applicant.state ?? "",
          licensed,
        },
      }),
    onSuccess: (res: { token: string }) => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setLink(`${origin}/portal-invite/${res.token}`);
      setError("");
      onDone();
    },
    onError: (e: unknown) => setError((e as Error).message || "Could not promote applicant."),
  });

  const parents = ctxQ.data?.parents ?? [];
  const teams = ctxQ.data?.teams ?? [];
  const canPromote = (ctxQ.data?.allowedRoles ?? []).includes("agent");

  return (
    <Modal
      title="Promote to Agent"
      description="Creates a secure portal invitation and moves them to Active. The account is created when they accept."
      onClose={onClose}
    >
      {!canPromote ? (
        <div className="p-body">Your account isn't permitted to invite agents.</div>
      ) : link ? (
        <div>
          <div className="p-secondary mb-2">Invitation created. Share this link:</div>
          <div className="flex gap-2">
            <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  /* noop */
                }
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <Button variant="ghost" className="mt-4 w-full" onClick={onClose}>Done</Button>
        </div>
      ) : (
        <div className="grid gap-4">
          <Field label="Role">
            <Select value={role} onChange={(e) => setRole(e.target.value as any)}>
              <option value="agent">Agent</option>
              {(ctxQ.data?.allowedRoles ?? []).includes("leader") && <option value="leader">Leader</option>}
            </Select>
          </Field>
          <Field label="Reports to">
            <Select value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">— none —</option>
              {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Team">
            <Select value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">— none —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <label className="inline-flex items-center gap-2 text-[13px]" style={{ color: "var(--p-text-2)" }}>
            <input type="checkbox" checked={licensed} onChange={(e) => setLicensed(e.target.checked)} />
            Currently licensed
          </label>
          {error && (
            <div className="rounded-[10px] border p-3 text-[13px]" style={{ borderColor: "var(--p-red)", background: "rgba(220,106,98,0.1)", color: "var(--p-red)" }}>
              {error}
            </div>
          )}
          <div className="mt-1 flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button variant="primary" className="flex-1" onClick={() => mut.mutate()} disabled={mut.isPending || !email.trim()}>
              {mut.isPending ? "Promoting…" : "Confirm & create invitation"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function DiscordCard({ applicantId, confirmed, onChange }: { applicantId: string; confirmed: boolean; onChange: () => void }) {
  const setFlag = useServerFn(setDiscordConfirmed);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      await setFlag({ data: { id: applicantId, value: !confirmed } });
      onChange();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="Discord confirmation" description={`Confirm once you've seen their course-post screenshot in #unlicensed.`}>
      <Button variant={confirmed ? "secondary" : "ghost"} onClick={toggle} disabled={busy}>
        {confirmed ? "✓ Course post confirmed" : "Mark course post confirmed"}
      </Button>
    </Panel>
  );
}

function FollowUpCard({ applicantId, onSent }: { applicantId: string; onSent: () => void }) {
  const send = useServerFn(sendFollowUpEmail);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function onSend() {
    setSending(true);
    setError("");
    try {
      await send({ data: { id: applicantId } });
      setSent(true);
      setTimeout(() => setSent(false), 2500);
      onSent();
    } catch (e) {
      setError((e as Error).message || "Could not send follow-up.");
    } finally {
      setSending(false);
    }
  }
  return (
    <Panel title="Pre-licensing follow-up" description="Sends the weekly check-in template and logs it on the timeline.">
      <Button variant="ghost" onClick={onSend} disabled={sending}>
        {sending ? "Sending…" : sent ? "✓ Follow-up sent" : "Send follow-up email"}
      </Button>
      {error && <p className="p-muted mt-2" style={{ color: "var(--p-red)" }}>{error}</p>}
    </Panel>
  );
}

function SendEvaluationCard({ applicant }: { applicant: any }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${origin}/evaluation?a=${applicant.id}`;
  const alreadyHired = !!applicant.hired_at;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  }
  return (
    <Panel title="Evaluation form" description="Send this pre-filled link after the overview.">
      {alreadyHired ? (
        <div className="rounded-[10px] border px-3 py-2.5 text-[13px]" style={{ borderColor: "var(--p-green)", background: "rgba(63,179,127,0.1)", color: "var(--p-green)" }}>
          ✓ Evaluation submitted.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="min-w-[180px] flex-1" />
          <Button variant="primary" onClick={copy} className="shrink-0">{copied ? "Copied!" : "Copy link"}</Button>
          <a href={link} target="_blank" rel="noreferrer noopener" className="shrink-0">
            <Button variant="ghost">Open →</Button>
          </a>
        </div>
      )}
    </Panel>
  );
}

function OnboardingProgressCard({ steps }: { steps: unknown }) {
  const { done, total } = onboardingProgress(steps);
  const s = (steps ?? {}) as Record<string, { completed?: boolean }>;
  return (
    <Panel title="Recruiting progress — onboarding" actions={<Badge tone={done === total ? "green" : "gold"}>{done}/{total}</Badge>}>
      <div className="flex flex-col gap-2">
        {ONBOARDING_STEP_ORDER.map((k) => {
          const stepDone = s[k]?.completed === true;
          return (
            <div key={k} className="flex items-center gap-2.5 text-[13px]">
              <span
                className="flex h-4 w-4 flex-none items-center justify-center rounded-full border text-[10px]"
                style={stepDone ? { borderColor: "var(--p-green)", background: "var(--p-green)", color: "#0B0B0C" } : { borderColor: "var(--p-border-strong)", color: "transparent" }}
              >
                ✓
              </span>
              <span className={stepDone ? "p-body" : "p-secondary"}>{ONBOARDING_STEP_LABELS[k]}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function OverviewToggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: (v: boolean) => void }) {
  return (
    <Button variant={active ? "secondary" : "ghost"} size="sm" onClick={() => onToggle(!active)}>
      <span
        className="flex h-4 w-4 items-center justify-center rounded-full border text-[10px]"
        style={active ? { borderColor: "var(--p-green)", background: "var(--p-green)", color: "#0B0B0C" } : { borderColor: "var(--p-border-strong)" }}
      >
        {active ? "✓" : ""}
      </span>
      {label}
    </Button>
  );
}
