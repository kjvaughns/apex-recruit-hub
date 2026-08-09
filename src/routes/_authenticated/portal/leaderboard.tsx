import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import { getCompanyLeaderboard, type CompanyLeaderboardRow } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/portal/leaderboard")({
  head: () => ({
    meta: [{ title: "Leaderboard — Vantage Portal" }, { name: "robots", content: "noindex" }],
  }),
  component: LeaderboardPage,
});

type Metric =
  "new_applicants" | "contacted" | "interviews_scheduled" | "interviews_completed" | "promoted";
type Period = "today" | "week" | "month" | "quarter" | "year" | "all";

const METRICS: { key: Metric; label: string }[] = [
  { key: "new_applicants", label: "New Applicants" },
  { key: "contacted", label: "Contacted" },
  { key: "interviews_scheduled", label: "Interviews Scheduled" },
  { key: "interviews_completed", label: "Interviews Completed" },
  { key: "promoted", label: "Promoted to Agent" },
];
const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
  { key: "year", label: "Year" },
  { key: "all", label: "All time" },
];

function initials(name: string | null) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

function LeaderboardPage() {
  const [metric, setMetric] = useState<Metric>("new_applicants");
  const [period, setPeriod] = useState<Period>("month");
  const [role, setRole] = useState<"" | "agent" | "leader" | "manager" | "admin">("");
  const [teamId, setTeamId] = useState("");
  const [selected, setSelected] = useState<(CompanyLeaderboardRow & { rank: number }) | null>(null);

  const fn = useServerFn(getCompanyLeaderboard);
  const q = useQuery({
    queryKey: ["leaderboard", metric, period, role, teamId],
    queryFn: () => fn({ data: { metric, period, role, team_id: teamId } }),
  });

  const rows = q.data?.rows ?? [];
  const meId = q.data?.meId;
  const teams = q.data?.teams ?? [];
  const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));

  return (
    <PortalShell>
      <PortalHeader
        kicker="Performance"
        title="Company leaderboard"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="apx-input h-9 text-[12.5px]"
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
            >
              {PERIODS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
            <select
              className="apx-input h-9 text-[12.5px]"
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
            >
              <option value="">All roles</option>
              <option value="agent">Agent</option>
              <option value="leader">Leader</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            <select
              className="apx-input h-9 text-[12.5px]"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              <option value="">All teams</option>
              {teams.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        }
      />
      <div className="px-6 py-8 md:px-10">
        {/* Metric selector */}
        <div className="mb-5 flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`rounded-full border px-3 py-1.5 text-[12px] transition ${
                metric === m.key
                  ? "border-apex-gold/40 bg-apex-gold/10 text-apex-gold"
                  : "border-white/10 text-apex-dim hover:text-apex-ivory"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {q.isLoading ? (
          <div className="apx-card p-10 text-center text-apex-dim">Loading…</div>
        ) : ranked.length === 0 ? (
          <div className="apx-card p-10 text-center text-apex-dim">
            No results for these filters.
          </div>
        ) : (
          <div className="apx-card divide-y divide-white/[0.05] overflow-hidden">
            {ranked.map((r) => {
              const isMe = r.profile_id === meId;
              const move = r.total - r.prev_total;
              return (
                <button
                  key={r.profile_id}
                  onClick={() => setSelected(r)}
                  className={`flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-white/[0.02] md:px-5 ${
                    isMe ? "border-l-2 border-apex-gold bg-apex-gold/[0.04]" : ""
                  }`}
                >
                  <span className="w-6 flex-none text-center font-display text-[18px] text-apex-muted">
                    {r.rank}
                  </span>
                  <span className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-full bg-white/10 text-[12px] font-semibold text-apex-fog">
                    {r.avatar_url ? (
                      <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initials(r.full_name)
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-apex-ivory">
                      {r.full_name || "Unnamed"}{" "}
                      {isMe && <span className="text-apex-gold">(you)</span>}
                    </span>
                    <span className="block truncate text-[12px] text-apex-faint capitalize">
                      {r.role ?? "—"}
                      {r.team_name ? ` · ${r.team_name}` : ""}
                    </span>
                  </span>
                  <span className="hidden text-right text-[12px] text-apex-faint sm:block">
                    {Math.round(r.conversion * 100)}%
                    <span className="block text-[10px]">conv.</span>
                  </span>
                  <span className="w-14 flex-none text-right">
                    <span className="font-display text-[22px] text-apex-gold">{r.total}</span>
                    {move !== 0 && (
                      <span
                        className={`block text-[11px] ${move > 0 ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {move > 0 ? "▲" : "▼"} {Math.abs(move)}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && <ProfileModal row={selected} onClose={() => setSelected(null)} />}
    </PortalShell>
  );
}

function ProfileModal({
  row,
  onClose,
}: {
  row: CompanyLeaderboardRow & { rank: number };
  onClose: () => void;
}) {
  const stats: { label: string; value: string }[] = [
    { label: "Rank", value: `#${row.rank}` },
    { label: "New applicants", value: String(row.new_count) },
    { label: "Contacted", value: String(row.contacted_count) },
    { label: "Interviews scheduled", value: String(row.scheduled_count) },
    { label: "Interviews completed", value: String(row.completed_count) },
    { label: "Promoted to agent", value: String(row.promoted_count) },
    { label: "Conversion rate", value: `${Math.round(row.conversion * 100)}%` },
  ];
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="apx-card w-full max-w-[440px] p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-apex-gold/15 font-display text-apex-gold">
            {row.avatar_url ? (
              <img src={row.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(row.full_name)
            )}
          </span>
          <div>
            <div className="font-display text-[24px] leading-none">
              {row.full_name || "Unnamed"}
            </div>
            <div className="text-[12.5px] text-apex-faint capitalize">
              {row.role ?? "—"}
              {row.team_name ? ` · ${row.team_name}` : ""}
              {row.manager_name ? ` · Reports to ${row.manager_name}` : ""}
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-apex-faint">
                {s.label}
              </div>
              <div className="mt-1 font-display text-[22px] text-apex-ivory">{s.value}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11.5px] text-apex-faint">
          Public performance summary — no private applicant data is shown.
        </p>
        <button onClick={onClose} className="apx-btn-ghost mt-4 w-full px-4 py-3 text-[13.5px]">
          Close
        </button>
      </div>
    </div>
  );
}
