import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import { listApplicants, updateApplicantStage, addAgent } from "@/lib/portal.functions";
import { AddApplicantModal } from "@/components/apex/add-applicant-modal";
import { AddAgentModal } from "@/components/apex/add-agent-modal";
import { RecruitingLinkCard } from "@/components/apex/recruiting-link-card";
import { onboardingProgress } from "@/lib/onboarding";

const searchSchema = z.object({
  tab: z.enum(["list", "pipeline"]).optional(),
});

export const Route = createFileRoute("/_authenticated/portal/applicants/")({
  head: () => ({
    meta: [{ title: "Applicants — Vantage Portal" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: ApplicantsPage,
});

type Scope = "mine" | "direct" | "downline" | "all";
const SCOPE_LABELS: Record<Scope, string> = {
  mine: "Mine",
  direct: "Direct",
  downline: "Downline",
  all: "All",
};
type View = "all" | "pre_licensing";

function ApplicantsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { tab } = Route.useSearch();
  const activeTab: "list" | "pipeline" = tab === "pipeline" ? "pipeline" : "list";

  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("mine");
  const [stage, setStage] = useState("");
  const [view, setView] = useState<View>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const [addStageId, setAddStageId] = useState<string | null>(null);

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? (localStorage.getItem("apex_crm_scope") as Scope | null) : null;
    if (saved && ["mine", "direct", "downline", "all"].includes(saved)) setScope(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("apex_crm_scope", scope);
  }, [scope]);

  const fn = useServerFn(listApplicants);
  const changeStage = useServerFn(updateApplicantStage);
  const addAgentFn = useServerFn(addAgent);

  // Shared query drives both tabs. The List tab additionally applies q/stage/view.
  const { data, isLoading } = useQuery({
    queryKey: ["applicants", { q, scope, stage, view, tab: activeTab }],
    queryFn: () =>
      fn({
        data:
          activeTab === "pipeline"
            ? { scope, limit: 200, q: "", stage: "", view: "all" }
            : { q, scope, stage, view, limit: 200 },
      }),
  });

  const stages = data?.stages ?? [];
  const stageMap = useMemo(() => {
    const m: Record<string, { name: string; color: string }> = {};
    for (const s of stages) m[s.id] = { name: s.name, color: s.color };
    return m;
  }, [stages]);
  const onboardingStageIds = useMemo(
    () => new Set(stages.filter((s: any) => s.slug === "onboarding").map((s: any) => s.id)),
    [stages],
  );

  function nextStageOf(currentId: string | null) {
    if (!currentId) return null;
    const i = stages.findIndex((s) => s.id === currentId);
    if (i < 0 || i >= stages.length - 1) return null;
    return stages[i + 1];
  }
  async function moveNext(applicantId: string, currentId: string | null) {
    const next = nextStageOf(currentId);
    if (!next) return;
    await changeStage({ data: { id: applicantId, stage_id: next.id } });
    qc.invalidateQueries({ queryKey: ["applicants"] });
  }

  function setTab(t: "list" | "pipeline") {
    navigate({ to: "/portal/applicants", search: t === "pipeline" ? { tab: "pipeline" } : {} });
  }

  const applicants = data?.applicants ?? [];

  return (
    <PortalShell>
      <PortalHeader
        kicker="Recruiting"
        title="Applicants"
        actions={
          <div className="flex items-center gap-2">
            <ScopeToggle scope={scope} setScope={setScope} />
            <button
              onClick={() => setAddAgentOpen(true)}
              className="rounded-[10px] border border-apex-gold/30 bg-apex-gold/[0.06] px-3 py-2 text-[12.5px] font-medium text-apex-gold transition hover:bg-apex-gold/[0.12]"
            >
              + Add Agent
            </button>
            <button onClick={() => setAddOpen(true)} className="apx-btn-primary px-3 py-2 text-[12.5px]">
              + Add Applicant
            </button>
          </div>
        }
      />

      <div className="px-6 py-6 md:px-10">
        <div className="mb-5">
          <RecruitingLinkCard variant="compact" />
        </div>

        {/* Tab switcher */}
        <div className="mb-5 inline-flex overflow-hidden rounded-[10px] border border-[var(--apx-hairline)]">
          {(["list", "pipeline"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-[13px] font-semibold capitalize transition ${
                activeTab === t
                  ? "bg-apex-gold text-apex-card"
                  : "bg-transparent text-apex-dim hover:bg-[var(--apx-hover)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {activeTab === "list" ? (
          <ListView
            data={data}
            isLoading={isLoading}
            q={q}
            setQ={setQ}
            stage={stage}
            setStage={setStage}
            view={view}
            setView={setView}
            setScope={setScope}
            stageMap={stageMap}
            onboardingStageIds={onboardingStageIds}
            nextStageOf={nextStageOf}
            moveNext={moveNext}
          />
        ) : (
          <PipelineView
            stages={stages}
            applicants={applicants}
            isLoading={isLoading}
            onAdd={(stageId) => {
              setAddStageId(stageId);
              setAddOpen(true);
            }}
          />
        )}
      </div>

      {addOpen && (
        <AddApplicantModal
          defaultStageId={addStageId ?? undefined}
          onClose={() => {
            setAddOpen(false);
            setAddStageId(null);
          }}
          onCreated={(id) => {
            setAddOpen(false);
            setAddStageId(null);
            qc.invalidateQueries({ queryKey: ["applicants"] });
            navigate({ to: "/portal/applicants/$applicantId", params: { applicantId: id } });
          }}
        />
      )}
      {addAgentOpen && (
        <AddAgentModal
          onClose={() => setAddAgentOpen(false)}
          onSubmit={async (fields) => {
            const res = await addAgentFn({ data: fields });
            setAddAgentOpen(false);
            qc.invalidateQueries({ queryKey: ["applicants"] });
            toast.success("Agent added — onboarding invite sent.", {
              action: {
                label: "View record",
                onClick: () =>
                  navigate({ to: "/portal/applicants/$applicantId", params: { applicantId: res.id } }),
              },
            });
          }}
        />
      )}
    </PortalShell>
  );
}

function ScopeToggle({ scope, setScope }: { scope: Scope; setScope: (s: Scope) => void }) {
  return (
    <div className="flex overflow-hidden rounded-[10px] border border-[var(--apx-hairline)]">
      {(["mine", "direct", "downline", "all"] as const).map((s) => (
        <button
          key={s}
          onClick={() => setScope(s)}
          className={`px-3 py-2 text-[12.5px] transition ${
            scope === s
              ? "bg-apex-gold text-apex-card"
              : "bg-transparent text-apex-dim hover:bg-[var(--apx-hover)]"
          }`}
        >
          {SCOPE_LABELS[s]}
        </button>
      ))}
    </div>
  );
}

function ListView({
  data,
  isLoading,
  q,
  setQ,
  stage,
  setStage,
  view,
  setView,
  setScope,
  stageMap,
  onboardingStageIds,
  nextStageOf,
  moveNext,
}: any) {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-[10px] border border-[var(--apx-hairline)]">
          <button
            onClick={() => setView("all")}
            className={`px-3.5 py-2 text-[12.5px] transition ${
              view === "all"
                ? "bg-apex-gold text-apex-card"
                : "bg-transparent text-apex-dim hover:bg-[var(--apx-hover)]"
            }`}
          >
            All applicants
          </button>
          <button
            onClick={() => setView("pre_licensing")}
            className={`px-3.5 py-2 text-[12.5px] transition ${
              view === "pre_licensing"
                ? "bg-apex-gold text-apex-card"
                : "bg-transparent text-apex-dim hover:bg-[var(--apx-hover)]"
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
          <select className="apx-input max-w-[220px]" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">All stages</option>
            {(data?.stages ?? []).map((s: any) => (
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
        <div className="hidden grid-cols-[1.5fr_1.2fr_0.9fr_1fr_0.9fr_auto] gap-4 border-b border-[var(--apx-hairline)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-apex-faint md:grid">
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
                  className="grid grid-cols-1 gap-1 border-b border-[var(--apx-hairline-2)] px-5 py-4 transition hover:bg-[var(--apx-hover)] md:grid-cols-[1.5fr_1.2fr_0.9fr_1fr_0.9fr_auto] md:items-center md:gap-4"
                >
                  <Link to="/portal/applicants/$applicantId" params={{ applicantId: a.id }} className="min-w-0">
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
                        style={{ borderColor: `${s.color}55`, background: `${s.color}18`, color: s.color }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                        {s.name}
                      </span>
                    ) : (
                      <span className="text-[11.5px] text-apex-faint">—</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {a.current_stage_id && onboardingStageIds.has(a.current_stage_id)
                      ? (() => {
                          const p = onboardingProgress(a.onboarding_steps);
                          return (
                            <Chip tone={p.done === p.total ? "good" : "warn"}>
                              Onboarding {p.done}/{p.total}
                            </Chip>
                          );
                        })()
                      : null}
                    <Chip tone={licensed ? "good" : "warn"}>{licensed ? "Licensed" : "Unlicensed"}</Chip>
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
                              {days === null ? "No follow-up yet" : `${days}d since follow-up`}
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
                      to="/portal/applicants/$applicantId"
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
    </>
  );
}

function PipelineView({
  stages,
  applicants,
  isLoading,
  onAdd,
}: {
  stages: any[];
  applicants: any[];
  isLoading: boolean;
  onAdd: (stageId: string | null) => void;
}) {
  if (isLoading) return <div className="apx-card p-10 text-center text-apex-dim">Loading…</div>;
  return (
    <div className="flex gap-4 overflow-x-auto pb-6">
      {stages.map((s: any) => {
        const items = applicants.filter((a: any) => a.current_stage_id === s.id);
        return (
          <div key={s.id} className="min-w-[280px] flex-1">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color || "#C9A84C" }} />
                <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-apex-ivory">
                  {s.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-apex-faint">{items.length}</span>
                <button
                  onClick={() => onAdd(s.id)}
                  title={`Add applicant to ${s.name}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--apx-hairline)] text-[14px] text-apex-dim transition hover:border-apex-gold/40 hover:text-apex-gold"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((a: any) => (
                <Link
                  key={a.id}
                  to="/portal/applicants/$applicantId"
                  params={{ applicantId: a.id }}
                  className="apx-card block p-3 transition hover:border-apex-gold/40"
                >
                  <div className="text-[13.5px] font-medium text-apex-ivory">
                    {a.first_name} {a.last_name}
                  </div>
                  <div className="text-[12px] text-apex-faint">
                    {a.city ?? ""}
                    {a.state ? `, ${a.state}` : ""}
                  </div>
                </Link>
              ))}
              <button
                onClick={() => onAdd(s.id)}
                className="rounded-[10px] border border-dashed border-[var(--apx-hairline)] p-2 text-center text-[12px] text-apex-faint transition hover:border-apex-gold/40 hover:text-apex-gold"
              >
                + Add applicant
              </button>
            </div>
          </div>
        );
      })}
    </div>
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
        : "border-[var(--apx-hairline)] bg-[var(--apx-hover)] text-apex-dim";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${cls}`}>
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
