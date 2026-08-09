import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import { listApplicants } from "@/lib/portal.functions";
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

function CRMListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("mine");
  const [stage, setStage] = useState("");
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
  const { data, isLoading } = useQuery({
    queryKey: ["applicants", { q, scope, stage }],
    queryFn: () => fn({ data: { q, scope, stage, limit: 200 } }),
  });

  const stageMap = useMemo(() => {
    const m: Record<string, { name: string; color: string }> = {};
    for (const s of data?.stages ?? []) m[s.id] = { name: s.name, color: s.color };
    return m;
  }, [data?.stages]);

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
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            className="apx-input max-w-[420px] flex-1"
            placeholder="Search by name, email, or phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
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
        </div>

        <div className="apx-card overflow-hidden p-0">
          <div className="hidden grid-cols-[1.6fr_1.3fr_1fr_1fr_0.8fr] gap-4 border-b border-white/[0.06] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-apex-faint md:grid">
            <div>Applicant</div>
            <div>Contact</div>
            <div>Stage</div>
            <div>Signals</div>
            <div className="text-right">Updated</div>
          </div>

          {isLoading ? (
            <div className="p-6 text-[13px] text-apex-faint">Loading…</div>
          ) : (data?.applicants ?? []).length === 0 ? (
            <div className="p-10 text-center text-[13.5px] text-apex-faint">
              No applicants match the filters. Try switching scope to{" "}
              <button className="text-apex-gold hover:underline" onClick={() => setScope("all")}>
                All
              </button>
              .
            </div>
          ) : (
            <div className="flex flex-col">
              {(data?.applicants ?? []).map((a) => {
                const s = a.current_stage_id ? stageMap[a.current_stage_id] : null;
                return (
                  <Link
                    key={a.id}
                    to="/portal/crm/$applicantId"
                    params={{ applicantId: a.id }}
                    className="grid grid-cols-1 gap-1 border-b border-white/[0.04] px-5 py-4 transition hover:bg-white/[0.02] md:grid-cols-[1.6fr_1.3fr_1fr_1fr_0.8fr] md:items-center md:gap-4"
                  >
                    <div>
                      <div className="text-[14.5px] font-semibold text-apex-ivory">
                        {a.first_name} {a.last_name}
                      </div>
                      <div className="text-[12px] text-apex-faint">
                        {a.city || "—"}
                        {a.state ? `, ${a.state}` : ""}
                      </div>
                    </div>
                    <div className="text-[13px] text-apex-dim">
                      <div className="truncate">{a.email}</div>
                      <div className="text-[11.5px] text-apex-faint">{a.phone}</div>
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
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: s.color }}
                          />
                          {s.name}
                        </span>
                      ) : (
                        <span className="text-[11.5px] text-apex-faint">—</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {a.licensed && <Chip>Licensed</Chip>}
                      {a.evaluation_completed_at && <Chip>Evaluated</Chip>}
                      {a.calendly_scheduled_at && <Chip>Scheduled</Chip>}
                    </div>
                    <div className="text-right text-[11.5px] text-apex-faint">
                      {relative(a.updated_at)}
                    </div>
                  </Link>
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

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-apex-dim">
      {children}
    </span>
  );
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
