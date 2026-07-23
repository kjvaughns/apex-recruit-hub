import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import { listApplicants } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/portal/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline — APEX Portal" }, { name: "robots", content: "noindex" }] }),
  component: PipelinePage,
});

function PipelinePage() {
  const fn = useServerFn(listApplicants);
  const { data, isLoading } = useQuery({
    queryKey: ["pipeline", "board"],
    queryFn: () => fn({ data: { scope: "all", limit: 200, q: "", stage: "" } }),
  });

  const stages = data?.stages ?? [];
  const applicants = data?.applicants ?? [];

  return (
    <PortalShell>
      <PortalHeader kicker="Recruiting" title="Pipeline board" />
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
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color || "#C9A84C" }} />
                      <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-apex-ivory">{s.name}</span>
                    </div>
                    <span className="text-[12px] text-apex-faint">{items.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.map((a: any) => (
                      <div key={a.id} className="apx-card p-3">
                        <div className="text-[13.5px] font-medium text-apex-ivory">{a.first_name} {a.last_name}</div>
                        <div className="text-[12px] text-apex-faint">{a.city ?? ""}{a.state ? `, ${a.state}` : ""}</div>
                      </div>
                    ))}
                    {items.length === 0 && <div className="rounded-[10px] border border-dashed border-white/[0.06] p-4 text-center text-[12px] text-apex-faint">Empty</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PortalShell>
  );
}
