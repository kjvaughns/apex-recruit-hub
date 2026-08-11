import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PortalShell } from "@/components/apex/portal-shell";
import {
  getApplicant,
  updateApplicantStage,
  addApplicantNote,
  setOverviewStatus,
  sendFollowUpEmail,
  setDiscordConfirmed,
} from "@/lib/portal.functions";
import { getInvitableContext, promoteApplicantToAgent } from "@/lib/invitations.functions";
import {
  onboardingProgress,
  ONBOARDING_STEP_ORDER,
  ONBOARDING_STEP_LABELS,
} from "@/lib/onboarding";
import {
  PageHeader,
  PageBody,
  Panel,
  Button,
  Badge,
  Textarea,
  Select,
  Input,
  Field,
  Modal,
} from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/applicants/$applicantId")({
  head: () => ({
    meta: [{ title: "Applicant — Vantage Portal" }, { name: "robots", content: "noindex" }],
  }),
  component: ApplicantDetailPage,
});

function ApplicantDetailPage() {
  const { applicantId } = Route.useParams();
  const qc = useQueryClient();
  const fetchOne = useServerFn(getApplicant);
  const changeStage = useServerFn(updateApplicantStage);
  const addNote = useServerFn(addApplicantNote);
  const setOverview = useServerFn(setOverviewStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["applicant", applicantId],
    queryFn: () => fetchOne({ data: { id: applicantId } }),
  });

  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);

  async function onStage(stageId: string) {
    await changeStage({ data: { id: applicantId, stage_id: stageId } });
    qc.invalidateQueries({ queryKey: ["applicant", applicantId] });
    qc.invalidateQueries({ queryKey: ["applicants"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function onOverview(field: "scheduled" | "completed", value: boolean) {
    await setOverview({ data: { id: applicantId, field, value } });
    qc.invalidateQueries({ queryKey: ["applicant", applicantId] });
    qc.invalidateQueries({ queryKey: ["applicants"] });
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
      <PageBody>
        <PageHeader
          title={isLoading || !a ? "Loading…" : `${a.first_name} ${a.last_name}`}
          description="CRM › Applicant"
          actions={
            <>
              <Link to="/portal/applicants">
                <Button variant="ghost" size="sm">← Back to Applicants</Button>
              </Link>
              {a && !a.portal_profile_id && (
                <Button variant="primary" size="sm" onClick={() => setPromoteOpen(true)}>
                  {a.promoted_to_agent_at ? "Invitation pending" : "Promote to Agent"}
                </Button>
              )}
              {a?.portal_profile_id && <Badge tone="green">Portal account active</Badge>}
              {currentStage && (
                <span
                  className="inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-[12px] font-semibold"
                  style={{ background: `${currentStage.color}18`, color: currentStage.color }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: currentStage.color }} />
                  {currentStage.name}
                </span>
              )}
            </>
          }
        />

        {isLoading || !a ? (
          <div className="p-body py-10 text-center">Loading applicant…</div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="flex flex-col gap-4">
              <Panel title="Contact">
                <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
                  <DField label="Email" value={a.email} />
                  <DField label="Phone" value={a.phone ?? "—"} />
                  <DField
                    label="Location"
                    value={[a.city, a.state, a.zip].filter(Boolean).join(", ") || "—"}
                  />
                  <DField
                    label="Licensing status"
                    value={
                      (a.licensing_status as string | null) || (a.licensed ? "Licensed" : "Unlicensed")
                    }
                  />
                  <DField label="Referring recruiter" value={data?.referringRecruiterName || "—"} />
                  <DField label="Date applied" value={new Date(a.created_at).toLocaleDateString()} />
                  <DField label="Last activity" value={lastActivity(data?.activities, a.updated_at)} />
                  <DField label="Priority" value={a.priority} />
                  <DField label="Status" value={a.status} />
                </dl>
                {a.why_text && (
                  <div className="mt-4">
                    <div className="p-label mb-1">Why Vantage</div>
                    <p className="p-body leading-relaxed whitespace-pre-wrap">{a.why_text}</p>
                  </div>
                )}
              </Panel>

              {currentStage?.slug === "onboarding" && (
                <OnboardingProgressCard steps={(a as any).onboarding_steps} />
              )}

              <Panel title="Move to stage">
                <div className="flex flex-wrap gap-1.5">
                  {(data?.stages ?? []).map((s) => {
                    const active = s.id === a.current_stage_id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => onStage(s.id)}
                        disabled={active}
                        className="p-focus rounded-md border px-2.5 py-1 text-[12px] font-semibold transition disabled:opacity-100"
                        style={{
                          borderColor: active ? s.color : "var(--p-border)",
                          background: active ? `${s.color}22` : "transparent",
                          color: active ? s.color : "var(--p-text-2)",
                        }}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </Panel>

              <Panel
                title="Overview meeting"
                description="Booking through Calendly updates this automatically. Use these toggles when you book the overview for them manually."
              >
                <div className="flex flex-wrap gap-2">
                  <OverviewToggle
                    label="Scheduled"
                    active={!!(a as any).overview_scheduled_at}
                    onToggle={(v) => onOverview("scheduled", v)}
                  />
                  <OverviewToggle
                    label="Completed"
                    active={!!(a as any).overview_completed_at}
                    onToggle={(v) => onOverview("completed", v)}
                  />
                </div>
                {(a as any).overview_completed_at && (
                  <p className="p-secondary mt-3" style={{ color: "var(--p-green)" }}>
                    Overview completed — this applicant is ready for the evaluation form.
                  </p>
                )}
              </Panel>

              <SendEvaluationCard applicant={a} />

              {!a.licensed && a.hired_at && (
                <DiscordCard
                  applicantId={applicantId}
                  confirmed={!!(a as any).discord_confirmed}
                  onChange={() => {
                    qc.invalidateQueries({ queryKey: ["applicant", applicantId] });
                    qc.invalidateQueries({ queryKey: ["applicants"] });
                  }}
                />
              )}

              <FollowUpCard
                applicantId={applicantId}
                onSent={() => {
                  qc.invalidateQueries({ queryKey: ["applicant", applicantId] });
                  qc.invalidateQueries({ queryKey: ["applicants"] });
                }}
              />

              {(data?.evaluations ?? []).length > 0 && (
                <Panel title="Evaluation">
                  {data!.evaluations.map((ev) => (
                    <div key={ev.id} className="grid gap-2 text-[13px] sm:grid-cols-2">
                      {Object.entries((ev.answers as Record<string, string>) ?? {}).map(([k, v]) => (
                        <div key={k} className="rounded-[10px] border p-2.5" style={{ borderColor: "var(--p-border)", background: "var(--p-raised)" }}>
                          <div className="p-label mb-1">{k}</div>
                          <div className="p-body">{v}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </Panel>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <Panel title="Add a note">
                <Textarea
                  rows={4}
                  placeholder="What happened on the last touchpoint?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button
                  variant="primary"
                  className="mt-3 w-full"
                  onClick={onAddNote}
                  disabled={saving || !note.trim()}
                >
                  {saving ? "Saving…" : "Add note"}
                </Button>
              </Panel>

              <Panel title="Timeline">
                <div className="flex flex-col gap-3">
                  {(data?.activities ?? []).map((act) => (
                    <div key={act.id} className="border-b pb-3 last:border-0" style={{ borderColor: "var(--p-border)" }}>
                      <div className="p-secondary" style={{ color: "var(--p-gold)" }}>{eventLabel(act.event_type)}</div>
                      {act.summary && <div className="p-body mt-1">{act.summary}</div>}
                      <div className="p-muted mt-1">{new Date(act.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                  {(data?.activities ?? []).length === 0 && (
                    <div className="p-muted">No activity yet.</div>
                  )}
                </div>
              </Panel>
            </div>
          </div>
        )}
      </PageBody>
      {promoteOpen && a && (
        <PromoteModal
          applicant={a}
          onClose={() => setPromoteOpen(false)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["applicant", applicantId] });
            qc.invalidateQueries({ queryKey: ["applicants"] });
          }}
        />
      )}
    </PortalShell>
  );
}

function PromoteModal({
  applicant,
  onClose,
  onDone,
}: {
  applicant: any;
  onClose: () => void;
  onDone: () => void;
}) {
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
          state: applicant.state ?? "",
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
      description={
        <>
          This creates a secure portal invitation for{" "}
          <span style={{ color: "var(--p-text)" }}>
            {applicant.first_name} {applicant.last_name}
          </span>{" "}
          and moves them to Active Agent. It does not create the account until they accept.
        </>
      }
      onClose={onClose}
    >
      {!canPromote ? (
        <div className="p-body">
          Your account isn't permitted to invite agents. Ask an administrator or your manager to
          enable it.
        </div>
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
          <Button variant="ghost" className="mt-4 w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          <Field label="Role">
            <Select value={role} onChange={(e) => setRole(e.target.value as any)}>
              <option value="agent">Agent</option>
              {(ctxQ.data?.allowedRoles ?? []).includes("leader") && (
                <option value="leader">Leader</option>
              )}
            </Select>
          </Field>
          <Field label="Reports to">
            <Select value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">— none —</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Team">
            <Select value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">— none —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Email">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
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
            <Button variant="ghost" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => mut.mutate()}
              disabled={mut.isPending || !email.trim()}
            >
              {mut.isPending ? "Promoting…" : "Confirm & create invitation"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function DiscordCard({
  applicantId,
  confirmed,
  onChange,
}: {
  applicantId: string;
  confirmed: boolean;
  onChange: () => void;
}) {
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
    <Panel
      title="Discord confirmation"
      description={`Manually confirm once you've seen their "I got the course" screenshot in the #unlicensed channel.`}
    >
      <Button variant={confirmed ? "secondary" : "ghost"} onClick={toggle} disabled={busy}>
        {confirmed ? "✓ Course post confirmed" : "Mark course post confirmed"}
      </Button>
    </Panel>
  );
}

function FollowUpCard({
  applicantId,
  onSent,
}: {
  applicantId: string;
  onSent: () => void;
}) {
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
    <Panel
      title="Pre-licensing follow-up"
      description="Sends the weekly check-in template (Email 4) and logs it on the timeline."
    >
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
  const ready = !!applicant.overview_completed_at;
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
    <Panel
      title="Evaluation form"
      description={`Send this pre-filled link after the overview. When they submit, they're auto-hired and moved into ${applicant.licensed ? "Contracting" : "Licensing"}.`}
    >
      {alreadyHired ? (
        <div className="rounded-[10px] border px-3 py-2.5 text-[13px]" style={{ borderColor: "var(--p-green)", background: "rgba(63,179,127,0.1)", color: "var(--p-green)" }}>
          ✓ Evaluation submitted — auto-hired.
        </div>
      ) : (
        <>
          {!ready && (
            <p className="p-muted mb-3" style={{ color: "var(--p-gold)" }}>
              Tip: mark the overview completed above first — the form is meant to go out after the
              overview.
            </p>
          )}
          <div className="flex gap-2">
            <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <Button variant="primary" onClick={copy} className="shrink-0">
              {copied ? "Copied!" : "Copy link"}
            </Button>
            <a href={link} target="_blank" rel="noreferrer noopener" className="shrink-0">
              <Button variant="ghost">Open →</Button>
            </a>
          </div>
        </>
      )}
    </Panel>
  );
}

function OnboardingProgressCard({ steps }: { steps: unknown }) {
  const { done, total } = onboardingProgress(steps);
  const s = (steps ?? {}) as Record<string, { completed?: boolean; completed_at?: string | null }>;
  return (
    <Panel
      title="Onboarding progress"
      actions={<Badge tone={done === total ? "green" : "gold"}>{done}/{total}</Badge>}
    >
      <div className="flex flex-col gap-2">
        {ONBOARDING_STEP_ORDER.map((k) => {
          const stepDone = s[k]?.completed === true;
          return (
            <div key={k} className="flex items-center gap-2.5 text-[13px]">
              <span
                className="flex h-4 w-4 flex-none items-center justify-center rounded-full border text-[10px]"
                style={
                  stepDone
                    ? { borderColor: "var(--p-green)", background: "var(--p-green)", color: "#0B0B0C" }
                    : { borderColor: "var(--p-border-strong)", color: "transparent" }
                }
              >
                ✓
              </span>
              <span className={stepDone ? "p-body" : "p-secondary"}>
                {ONBOARDING_STEP_LABELS[k]}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function OverviewToggle({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <Button variant={active ? "secondary" : "ghost"} size="sm" onClick={() => onToggle(!active)}>
      <span
        className="flex h-4 w-4 items-center justify-center rounded-full border text-[10px]"
        style={
          active
            ? { borderColor: "var(--p-green)", background: "var(--p-green)", color: "#0B0B0C" }
            : { borderColor: "var(--p-border-strong)" }
        }
      >
        {active ? "✓" : ""}
      </span>
      {label}
    </Button>
  );
}

function DField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="p-label mb-1">{label}</div>
      <div className="p-body">{value}</div>
    </div>
  );
}

function lastActivity(
  activities: { created_at: string }[] | undefined,
  fallbackIso: string,
): string {
  const iso = activities && activities.length ? activities[0].created_at : fallbackIso;
  return new Date(iso).toLocaleDateString();
}

function eventLabel(t: string) {
  const map: Record<string, string> = {
    application_submitted: "Application submitted",
    evaluation_submitted: "Evaluation submitted",
    appointment_scheduled: "Appointment scheduled",
    overview_updated: "Overview updated",
    follow_up_sent: "Follow-up sent",
    discord_updated: "Discord confirmation",
    stage_changed: "Stage changed",
    note: "Note",
  };
  return map[t] ?? t.replace(/_/g, " ");
}
