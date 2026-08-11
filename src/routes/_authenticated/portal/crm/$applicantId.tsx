import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
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

export const Route = createFileRoute("/_authenticated/portal/crm/$applicantId")({
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
      <PortalHeader
        kicker="CRM › Applicant"
        title={isLoading || !a ? "Loading…" : `${a.first_name} ${a.last_name}`}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/portal/crm" className="apx-btn-ghost px-3 py-2 text-[12.5px]">
              ← Back to CRM
            </Link>
            {a && !a.portal_profile_id && (
              <button
                onClick={() => setPromoteOpen(true)}
                className="apx-btn-primary px-3 py-2 text-[12.5px]"
              >
                {a.promoted_to_agent_at ? "Invitation pending" : "Promote to Agent"}
              </button>
            )}
            {a?.portal_profile_id && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-semibold text-emerald-300">
                Portal account active
              </span>
            )}
            {currentStage && (
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold"
                style={{
                  borderColor: `${currentStage.color}55`,
                  background: `${currentStage.color}18`,
                  color: currentStage.color,
                }}
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
                <Field
                  label="Location"
                  value={[a.city, a.state, a.zip].filter(Boolean).join(", ") || "—"}
                />
                <Field
                  label="Licensing status"
                  value={
                    (a.licensing_status as string | null) || (a.licensed ? "Licensed" : "Unlicensed")
                  }
                />
                <Field label="Referring recruiter" value={data?.referringRecruiterName || "—"} />
                <Field label="Date applied" value={new Date(a.created_at).toLocaleDateString()} />
                <Field label="Last activity" value={lastActivity(data?.activities, a.updated_at)} />
                <Field label="Priority" value={a.priority} />
                <Field label="Status" value={a.status} />
              </dl>
              {a.why_text && (
                <div className="mt-6">
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-apex-faint">
                    Why Vantage
                  </div>
                  <p className="text-[14px] leading-relaxed text-apex-fog whitespace-pre-wrap">
                    {a.why_text}
                  </p>
                </div>
              )}
            </div>

            {currentStage?.slug === "onboarding" && (
              <OnboardingProgressCard steps={(a as any).onboarding_steps} />
            )}

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

            <div className="apx-card p-6">
              <h2 className="mb-1 font-display text-[20px] leading-none">Overview meeting</h2>
              <p className="mb-4 text-[12.5px] text-apex-faint">
                Booking through Calendly updates this automatically. Use these toggles when you book
                the overview for them manually.
              </p>
              <div className="flex flex-wrap gap-2.5">
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
                <p className="mt-3 text-[12px] text-emerald-300/80">
                  Overview completed — this applicant is ready for the evaluation form.
                </p>
              )}
            </div>

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

            <FollowUpCard applicantId={applicantId} onSent={() => {
              qc.invalidateQueries({ queryKey: ["applicant", applicantId] });
              qc.invalidateQueries({ queryKey: ["applicants"] });
            }} />


            {(data?.evaluations ?? []).length > 0 && (
              <div className="apx-card p-6">
                <h2 className="mb-4 font-display text-[20px] leading-none">Evaluation</h2>
                {data!.evaluations.map((ev) => (
                  <div key={ev.id} className="grid gap-2 text-[13.5px] md:grid-cols-2">
                    {Object.entries((ev.answers as Record<string, string>) ?? {}).map(([k, v]) => (
                      <div
                        key={k}
                        className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-3"
                      >
                        <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-apex-faint">
                          {k}
                        </div>
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
                    {act.summary && (
                      <div className="mt-1 text-[13.5px] text-apex-fog">{act.summary}</div>
                    )}
                    <div className="mt-1 text-[11px] text-apex-faint">
                      {new Date(act.created_at).toLocaleString()}
                    </div>
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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="apx-card max-h-[90vh] w-full max-w-[560px] overflow-y-auto p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-[26px] leading-none">Promote to Agent</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-apex-muted">
          This creates a secure portal invitation for{" "}
          <span className="text-apex-ivory">
            {applicant.first_name} {applicant.last_name}
          </span>{" "}
          and moves them to Active Agent. It does not create the account until they accept.
        </p>

        {!canPromote ? (
          <div className="mt-5 text-[14px] text-apex-muted">
            Your account isn't permitted to invite agents. Ask an administrator or your manager to
            enable it.
          </div>
        ) : link ? (
          <div className="mt-5">
            <div className="mb-2 text-[13px] text-apex-fog">
              Invitation created. Share this link:
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                className="apx-input flex-1 text-[12.5px]"
                value={link}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    /* noop */
                  }
                }}
                className="apx-btn-primary px-4 text-[12.5px]"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <button onClick={onClose} className="apx-btn-ghost mt-4 w-full px-4 py-3 text-[13.5px]">
              Done
            </button>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            <Row label="Role">
              <select
                className="apx-input"
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
              >
                <option value="agent">Agent</option>
                {(ctxQ.data?.allowedRoles ?? []).includes("leader") && (
                  <option value="leader">Leader</option>
                )}
              </select>
            </Row>
            <Row label="Reports to">
              <select
                className="apx-input"
                value={parent}
                onChange={(e) => setParent(e.target.value)}
              >
                <option value="">— none —</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Team">
              <select className="apx-input" value={team} onChange={(e) => setTeam(e.target.value)}>
                <option value="">— none —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Email">
              <input
                className="apx-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Row>
            <Row label="Phone">
              <input
                className="apx-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Row>
            <label className="inline-flex items-center gap-2 text-[13.5px] text-apex-dim">
              <input
                type="checkbox"
                checked={licensed}
                onChange={(e) => setLicensed(e.target.checked)}
              />
              Currently licensed
            </label>

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
                onClick={() => mut.mutate()}
                disabled={mut.isPending || !email.trim()}
                className="apx-btn-primary flex-1 px-4 py-3 text-[13.5px] disabled:opacity-60"
              >
                {mut.isPending ? "Promoting…" : "Confirm & create invitation"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-apex-muted">
        {label}
      </span>
      {children}
    </label>
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
    <div className="apx-card p-6">
      <h2 className="mb-1 font-display text-[20px] leading-none">Discord confirmation</h2>
      <p className="mb-4 text-[12.5px] text-apex-faint">
        Manually confirm once you've seen their "I got the course" screenshot in the #unlicensed
        channel.
      </p>
      <label className="inline-flex cursor-pointer items-center gap-3">
        <button
          onClick={toggle}
          disabled={busy}
          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition disabled:opacity-60 ${
            confirmed
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-white/10 text-apex-dim hover:border-apex-gold/40 hover:text-apex-ivory"
          }`}
        >
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${
              confirmed ? "border-emerald-400 bg-emerald-400 text-black" : "border-white/25"
            }`}
          >
            {confirmed ? "✓" : ""}
          </span>
          {confirmed ? "Course post confirmed" : "Mark course post confirmed"}
        </button>
      </label>
    </div>
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
    <div className="apx-card p-6">
      <h2 className="mb-1 font-display text-[20px] leading-none">Pre-licensing follow-up</h2>
      <p className="mb-4 text-[12.5px] text-apex-faint">
        Sends the weekly check-in template (Email 4) and logs it on the timeline.
      </p>
      <button
        onClick={onSend}
        disabled={sending}
        className="apx-btn-ghost px-4 py-2.5 text-[13px] disabled:opacity-60"
      >
        {sending ? "Sending…" : sent ? "✓ Follow-up sent" : "Send follow-up email"}
      </button>
      {error && <p className="mt-2 text-[12px] text-red-300">{error}</p>}
    </div>
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
    <div className="apx-card p-6">
      <h2 className="mb-1 font-display text-[20px] leading-none">Evaluation form</h2>
      <p className="mb-4 text-[12.5px] text-apex-faint">
        Send this pre-filled link after the overview. When they submit, they're auto-hired and moved
        into {applicant.licensed ? "Contracting" : "Licensing"}.
      </p>

      {alreadyHired ? (
        <div className="rounded-[10px] border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] text-emerald-300">
          ✓ Evaluation submitted — auto-hired.
        </div>
      ) : (
        <>
          {!ready && (
            <p className="mb-3 text-[12px] text-apex-gold/80">
              Tip: mark the overview completed above first — the form is meant to go out after the
              overview.
            </p>
          )}
          <div className="flex gap-2">
            <input
              readOnly
              className="apx-input flex-1 text-[12px]"
              value={link}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button onClick={copy} className="apx-btn-primary flex-none px-4 text-[12.5px]">
              {copied ? "Copied!" : "Copy link"}
            </button>
            <a
              href={link}
              target="_blank"
              rel="noreferrer noopener"
              className="apx-btn-ghost flex-none px-4 py-2 text-[12.5px]"
            >
              Open →
            </a>
          </div>
        </>
      )}
    </div>
  );
}

function OnboardingProgressCard({ steps }: { steps: unknown }) {
  const { done, total } = onboardingProgress(steps);
  const s = (steps ?? {}) as Record<string, { completed?: boolean; completed_at?: string | null }>;
  return (
    <div className="apx-card p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-[20px] leading-none">Onboarding progress</h2>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            done === total
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-apex-gold/30 bg-apex-gold/10 text-apex-gold"
          }`}
        >
          {done}/{total}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {ONBOARDING_STEP_ORDER.map((k) => {
          const done = s[k]?.completed === true;
          return (
            <div key={k} className="flex items-center gap-2.5 text-[13.5px]">
              <span
                className={`flex h-4 w-4 flex-none items-center justify-center rounded-full border text-[10px] ${
                  done ? "border-emerald-400 bg-emerald-400 text-black" : "border-white/25 text-transparent"
                }`}
              >
                ✓
              </span>
              <span className={done ? "text-apex-fog" : "text-apex-dim"}>
                {ONBOARDING_STEP_LABELS[k]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
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
    <button
      onClick={() => onToggle(!active)}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition ${
        active
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          : "border-white/10 bg-transparent text-apex-dim hover:border-apex-gold/40 hover:text-apex-ivory"
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${
          active ? "border-emerald-400 bg-emerald-400 text-black" : "border-white/25"
        }`}
      >
        {active ? "✓" : ""}
      </span>
      {label}
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-apex-faint">
        {label}
      </div>
      <div className="text-apex-fog">{value}</div>
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
