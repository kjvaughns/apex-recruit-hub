import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import { listApplicants } from "@/lib/portal.functions";
import { AddApplicantModal } from "@/components/apex/add-applicant-modal";

export const Route = createFileRoute("/_authenticated/portal/pipeline")({
  head: () => ({
    meta: [{ title: "Pipeline — Vantage Portal" }, { name: "robots", content: "noindex" }],
  }),
  component: PipelinePage,
});

type Scope = "mine" | "direct" | "downline" | "all";
const SCOPE_LABELS: Record<Scope, string> = {
  mine: "Mine",
  direct: "Direct",
  downline: "Downline",
  all: "All",
};

function PipelinePage() {
  const qc = useQueryClient();
  const [scope, setScope] = useState<Scope>("downline");
  const [addStage, setAddStage] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? (localStorage.getItem("apex_pipeline_scope") as Scope | null)
        : null;
    if (saved && ["mine", "direct", "downline", "all"].includes(saved)) setScope(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("apex_pipeline_scope", scope);
  }, [scope]);

  const fn = useServerFn(listApplicants);
  const { data, isLoading } = useQuery({
    queryKey: ["pipeline", "board", scope],
    queryFn: () => fn({ data: { scope, limit: 200, q: "", stage: "" } }),
  });

  const stages = data?.stages ?? [];
  const applicants = data?.applicants ?? [];

  function openAdd(stageId: string | null) {
    setAddStage(stageId);
    setAddOpen(true);
  }

  return (
    <PortalShell>
      <PortalHeader
        kicker="Recruiting"
        title="Pipeline board"
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
              onClick={() => openAdd(null)}
              className="apx-btn-primary px-3 py-2 text-[12.5px]"
            >
              + Add Applicant
            </button>
          </div>
        }
      />
      <div className="px-6 py-8 md:px-10">
        {isLoading ? (
          <div className="apx-card p-10 text-center text-apex-dim">Loading…</div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-6">
            {stages.map((s: any) => {
              const items = applicants.filter((a: any) => a.current_stage_id === s.id);
              return (
                <div key={s.id} className="min-w-[280px] flex-1">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: s.color || "#C9A84C" }}
                      />
                      <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-apex-ivory">
                        {s.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-apex-faint">{items.length}</span>
                      <button
                        onClick={() => openAdd(s.id)}
                        title={`Add applicant to ${s.name}`}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-[14px] text-apex-dim transition hover:border-apex-gold/40 hover:text-apex-gold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.map((a: any) => (
                      <Link
                        key={a.id}
                        to="/portal/crm/$applicantId"
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
                      onClick={() => openAdd(s.id)}
                      className="rounded-[10px] border border-dashed border-white/[0.1] p-2 text-center text-[12px] text-apex-faint transition hover:border-apex-gold/40 hover:text-apex-gold"
                    >
                      + Add applicant
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {addOpen && (
        <AddApplicantModal
          defaultStageId={addStage ?? undefined}
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            setAddOpen(false);
            qc.invalidateQueries({ queryKey: ["pipeline"] });
          }}
        />
      )}
    </PortalShell>
  );
}
