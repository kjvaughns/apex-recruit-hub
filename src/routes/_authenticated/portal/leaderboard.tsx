import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { getCompanyLeaderboard, type CompanyLeaderboardRow } from "@/lib/portal.functions";
import {
  PageHeader,
  PageBody,
  Toolbar,
  Select,
  SegmentedControl,
  TableWrap,
  Table,
  THead,
  TH,
  TR,
  TD,
  Avatar,
  Badge,
  EmptyState,
  Modal,
} from "@/components/portal/ui";

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
      <PageBody>
        <PageHeader title="Company leaderboard" description="Ranked performance across the company." />

        <div className="space-y-3">
          <Toolbar>
            {/* Metric: a Select on mobile (the 5-option segmented control overflows phones). */}
            <Select
              value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}
              className="h-9 w-full text-[13px] sm:hidden"
            >
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
            <SegmentedControl
              className="hidden sm:inline-flex"
              size="sm"
              options={METRICS.map((m) => ({ value: m.key, label: m.label }))}
              value={metric}
              onChange={setMetric}
            />
            <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="h-9 w-full text-[12.5px] sm:w-auto">
                {PERIODS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </Select>
              <Select value={role} onChange={(e) => setRole(e.target.value as any)} className="h-9 w-full text-[12.5px] sm:w-auto">
                <option value="">All roles</option>
                <option value="agent">Agent</option>
                <option value="leader">Leader</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </Select>
              <Select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="h-9 w-full text-[12.5px] sm:w-auto">
                <option value="">All teams</option>
                {teams.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
          </Toolbar>

          {q.isLoading ? (
            <TableWrap>
              <div className="p-secondary p-10 text-center">Loading…</div>
            </TableWrap>
          ) : ranked.length === 0 ? (
            <TableWrap>
              <EmptyState title="No results" description="No results for these filters. Try widening the period or clearing filters." />
            </TableWrap>
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <TH className="w-10">Rank</TH>
                  <TH>Agent</TH>
                  <TH align="right">Conv.</TH>
                  <TH align="right">Total</TH>
                  <TH align="right">Change</TH>
                </THead>
                <tbody>
                  {ranked.map((r) => {
                    const isMe = r.profile_id === meId;
                    const move = r.total - r.prev_total;
                    return (
                      <TR key={r.profile_id} onClick={() => setSelected(r)}>
                        <TD>
                          <span className="p-metric text-[15px]" style={isMe ? { color: "var(--p-gold)" } : undefined}>
                            {r.rank}
                          </span>
                        </TD>
                        <TD>
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Avatar name={r.full_name} src={r.avatar_url} size={28} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 truncate text-[13.5px] font-medium">
                                <span className="truncate">{r.full_name || "Unnamed"}</span>
                                {isMe && <Badge tone="gold">you</Badge>}
                              </div>
                              <div className="p-muted truncate text-[12px] capitalize">
                                {r.role ?? "—"}
                                {r.team_name ? ` · ${r.team_name}` : ""}
                              </div>
                            </div>
                          </div>
                        </TD>
                        <TD align="right" className="p-muted">
                          {Math.round(r.conversion * 100)}%
                        </TD>
                        <TD align="right">
                          <span className="p-metric text-[16px]" style={{ color: "var(--p-gold)" }}>
                            {r.total}
                          </span>
                        </TD>
                        <TD align="right">
                          {move !== 0 && (
                            <Badge tone={move > 0 ? "green" : "red"}>
                              {move > 0 ? "▲" : "▼"} {Math.abs(move)}
                            </Badge>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </div>
      </PageBody>

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
    <Modal
      title={row.full_name || "Unnamed"}
      description={
        <span className="capitalize">
          {row.role ?? "—"}
          {row.team_name ? ` · ${row.team_name}` : ""}
          {row.manager_name ? ` · Reports to ${row.manager_name}` : ""}
        </span>
      }
      onClose={onClose}
      width={440}
      footer={
        <button
          onClick={onClose}
          className="p-focus h-9 w-full rounded-[10px] border text-[13.5px] font-semibold transition hover:brightness-[1.08]"
          style={{ background: "var(--p-raised)", borderColor: "var(--p-border)", color: "var(--p-text)" }}
        >
          Close
        </button>
      }
    >
      <div className="flex items-center gap-3">
        <Avatar name={row.full_name} src={row.avatar_url} size={48} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="p-panel px-3 py-2.5">
            <div className="p-label uppercase tracking-[0.06em]">{s.label}</div>
            <div className="p-metric mt-1">{s.value}</div>
          </div>
        ))}
      </div>
      <p className="p-muted mt-4">
        Public performance summary — no private applicant data is shown.
      </p>
    </Modal>
  );
}
