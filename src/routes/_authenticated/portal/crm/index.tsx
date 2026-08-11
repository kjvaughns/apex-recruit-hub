import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import { listApplicants, updateApplicantStage } from "@/lib/portal.functions";
import { AddApplicantModal } from "@/components/apex/add-applicant-modal";

export const Route = createFileRoute("/_authenticated/portal/crm/")({
  head: () => ({ meta: [{ title: "CRM — Vantage Portal" }, { name: "robots", content: "noindex" }] }),
  component: CRMListPage,
});

type Scope = "mine" | "direct" | "downline" | "all";
const SCOPE_LABELS: Record<Scope, string> = {
  mine: "Mine",
  direct: "Direct",
  downline: "Downline",
  all: "All",
};

type View = "all" | "pre_licensing";

function CRMListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("mine");
  const [stage, setStage] = useState("");
  const [view, setView] = useState<View>("all");
  const [addOpen, setAddOpen] = useState(false);

  // Remember the last selected CRM scope per user session.
  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? (localStorage.getItem("apex_crm_scope") as Scope | null)
        : null;
    if (saved && ["mine", "direct", "downline", "all"].includes(saved)) setScope(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("apex_crm_scope", scope);
  }, [scope]);

  const fn = useServerFn(listApplicants);
  const changeStage = useServerFn(updateApplicantStage);
  const { data, isLoading } = useQuery({
    queryKey: ["applicants", { q, scope, stage, view }],
    queryFn: () => fn({ data: { q, scope, stage, view, limit: 200 } }),
  });

  const stageMap = useMemo(() => {
    const m: Record<string, { name: string; color: string }> = {};
    for (const s of data?.stages ?? []) m[s.id] = { name: s.name, color: s.color };
    return m;
  }, [data?.stages]);

  const orderedStages = data?.stages ?? [];

  function nextStageOf(currentId: string | null) {
    if (!currentId) return null;
    const i = orderedStages.findIndex((s) => s.id === currentId);
    if (i < 0 || i >= orderedStages.length - 1) return null;
    return orderedStages[i + 1];
  }

  async function moveNext(applicantId: string, currentId: string | null) {
    const next = nextStageOf(currentId);
    if (!next) return;
    await changeStage({ data: { id: applicantId, stage_id: next.id } });
    qc.invalidateQueries({ queryKey: ["applicants"] });
  }

  return (
    <PortalShell>
      <PortalHeader
        kicker="CRM"
        title="Applicants"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-[10px] border border-white/10">
              {(["mine", "direct", "downline", "all"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`px-3 py-2 text-[12.5px] transition ${
                    scope === s
                      ? "bg-apex-gold text-apex-card"
                      : "bg-transparent text-apex-dim hover:bg-white/5"
                  }`}
                >
                  {SCOPE_LABELS[s]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setAddOpen(true)}
              className="apx-btn-primary px-3 py-2 text-[12.5px]"
            >
              + Add Applicant
            </button>
          </div>
        }
      />

      <div className="px-6 py-6 md:px-10">
        {/* View tabs */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-[10px] border border-white/10">
            <button
              onClick={() => setView("all")}
              className={`px-3.5 py-2 text-[12.5px] transition ${
                view === "all"
                  ? "bg-apex-gold text-apex-card"
                  : "bg-transparent text-apex-dim hover:bg-white/5"
              }`}
            >
              All applicants
            </button>
            <button
              onClick={() => setView("pre_licensing")}
              className={`px-3.5 py-2 text-[12.5px] transition ${
                view === "pre_licensing"
                  ? "bg-apex-gold text-apex-card"
                  : "bg-transparent text-apex-dim hover:bg-white/5"
              }`}
            >
              Pre-Licensing Pipeline
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            className="apx-input max-w-[420px] flex-1"
            placeholder="Search by name, email, or phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {view === "all" && (
            <select
              className="apx-input max-w-[220px]"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            >
              <option value="">All stages</option>
              {(data?.stages ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {view === "pre_licensing" && (
          <p className="mb-3 text-[12.5px] text-apex-faint">
            Hired but not yet licensed, sorted by longest since last follow-up — the most overdue
            check-ins are at the top.
          </p>
        )}

        <div className="apx-card overflow-hidden p-0">
          <div className="hidden grid-cols-[1.5fr_1.2fr_0.9fr_1fr_0.9fr_auto] gap-4 border-b border-white/[0.06] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-apex-faint md:grid">
            <div>Applicant</div>
            <div>Contact</div>
            <div>Stage</div>
            <div>Signals</div>
            <div>Dates</div>
            <div className="text-right">Actions</div>
          </div>

          {isLoading ? (
            <div className="p-6 text-[13px] text-apex-faint">Loading…</div>
          ) : (data?.applicants ?? []).length === 0 ? (
            <div className="p-10 text-center text-[13.5px] text-apex-faint">
              {view === "pre_licensing" ? (
                "No hired-but-unlicensed applicants right now."
              ) : (
                <>
                  No applicants match the filters. Try switching scope to{" "}
                  <button className="text-apex-gold hover:underline" onClick={() => setScope("all")}>
                    All
                  </button>
                  .
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col">
              {(data?.applicants ?? []).map((a: any) => {
                const s = a.current_stage_id ? stageMap[a.current_stage_id] : null;
                const next = nextStageOf(a.current_stage_id);
                const licensed = !!a.licensed;
                return (
                  <div
                    key={a.id}
                    className="grid grid-cols-1 gap-1 border-b border-white/[0.04] px-5 py-4 transition hover:bg-white/[0.02] md:grid-cols-[1.5fr_1.2fr_0.9fr_1fr_0.9fr_auto] md:items-center md:gap-4"
                  >
                    <Link
                      to="/portal/crm/$applicantId"
                      params={{ applicantId: a.id }}
                      className="min-w-0"
                    >
                      <div className="text-[14.5px] font-semibold text-apex-ivory hover:text-apex-gold">
                        {a.first_name} {a.last_name}
                      </div>
                      <div className="text-[12px] text-apex-faint">
                        {a.city || "—"}
                        {a.state ? `, ${a.state}` : ""}
                        {a.referring_recruiter_name ? ` · ref: ${a.referring_recruiter_name}` : ""}
                      </div>
                    </Link>
                    <div className="min-w-0 text-[13px] text-apex-dim">
                      <div className="truncate">{a.email}</div>
                      <div className="text-[11.5px] text-apex-faint">{a.phone || "—"}</div>
                    </div>
                    <div>
                      {s ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                          style={{
                            borderColor: `${s.color}55`,
                            background: `${s.color}18`,
                            color: s.color,
                          }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                          {s.name}
                        </span>
                      ) : (
                        <span className="text-[11.5px] text-apex-faint">—</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Chip tone={licensed ? "good" : "warn"}>
                        {licensed ? "Licensed" : "Unlicensed"}
                      </Chip>
                      {a.hired_at && <Chip tone="good">Hired</Chip>}
                      {!a.hired_at && a.evaluation_completed_at && <Chip>Evaluated</Chip>}
                      {a.calendly_scheduled_at && <Chip>Scheduled</Chip>}
                      {a.discord_confirmed && <Chip tone="good">Discord ✓</Chip>}
                    </div>
                    <div className="text-[11.5px] text-apex-faint">
                      <div>Applied {shortDate(a.created_at)}</div>
                      <div>Active {relative(a.updated_at)}</div>
                      {view === "pre_licensing" &&
                        (() => {
                          const days = a.last_follow_up_at ? daysSince(a.last_follow_up_at) : null;
                          const overdue = days === null || days > 7;
                          return (
                            <div className="mt-0.5">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
                                  overdue
                                    ? "border-red-500/40 bg-red-500/10 text-red-300"
                                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                }`}
                              >
                                {days === null
                                  ? "No follow-up yet"
                                  : `${days}d since follow-up`}
                              </span>
                            </div>
                          );
                        })()}
                    </div>
                    <div className="flex items-center justify-start gap-1.5 md:justify-end">
                      {next && (
                        <button
                          onClick={() => moveNext(a.id, a.current_stage_id)}
                          title={`Move to ${next.name}`}
                          className="apx-btn-ghost px-2.5 py-1.5 text-[11.5px]"
                        >
                          Next →
                        </button>
                      )}
                      <Link
                        to="/portal/crm/$applicantId"
                        params={{ applicantId: a.id }}
                        className="apx-btn-ghost px-2.5 py-1.5 text-[11.5px]"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {addOpen && (
        <AddApplicantModal
          onClose={() => setAddOpen(false)}
          onCreated={(id) => {
            setAddOpen(false);
            qc.invalidateQueries({ queryKey: ["applicants"] });
            navigate({ to: "/portal/crm/$applicantId", params: { applicantId: id } });
          }}
        />
      )}
    </PortalShell>
  );
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn";
}) {
  const cls =
    tone === "good"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : tone === "warn"
        ? "border-apex-gold/30 bg-apex-gold/10 text-apex-gold"
        : "border-white/10 bg-white/[0.03] text-apex-dim";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {children}
    </span>
  );
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
}

function relative(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
