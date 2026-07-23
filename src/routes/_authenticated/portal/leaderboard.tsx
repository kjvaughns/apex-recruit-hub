import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import { getLeaderboard } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/portal/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — APEX Portal" }, { name: "robots", content: "noindex" }] }),
  component: LeaderboardPage,
});

type Win = "7d" | "30d" | "90d" | "all";

function LeaderboardPage() {
  const [win, setWin] = useState<Win>("30d");
  const fn = useServerFn(getLeaderboard);
  const q = useQuery({ queryKey: ["leaderboard", win], queryFn: () => fn({ data: { window: win } }) });
  const rows = q.data?.rows ?? [];

  return (
    <PortalShell>
      <PortalHeader
        kicker="Performance"
        title="Leaderboard"
        actions={
          <div className="flex gap-1">
            {(["7d", "30d", "90d", "all"] as Win[]).map((w) => (
              <button
                key={w}
                onClick={() => setWin(w)}
                className={`rounded-full border px-3 py-1.5 text-[12px] ${win === w ? "border-apex-gold/40 bg-apex-gold/10 text-apex-gold" : "border-white/10 text-apex-dim hover:text-apex-ivory"}`}
              >
                {w === "all" ? "All time" : `Last ${w}`}
              </button>
            ))}
          </div>
        }
      />
      <div className="px-6 py-8 md:px-10">
        {q.isLoading ? (
          <div className="text-center text-apex-dim">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-10 text-center text-apex-dim">
            No activity in this window yet.
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              {rows.slice(0, 3).map((r: any, i: number) => (
                <div key={r.user_id} className={`rounded-2xl border p-5 ${i === 0 ? "border-apex-gold/40 bg-apex-gold/10" : "border-white/[0.08] bg-white/[0.02]"}`}>
                  <div className="flex items-center gap-3">
                    <div className="font-display text-3xl text-apex-gold">#{i + 1}</div>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-apex-ivory">
                        {r.profile?.first_name} {r.profile?.last_name}
                      </div>
                      <div className="text-[12px] text-apex-faint">Score {r.score}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[11px]">
                    <Metric label="Apps" value={r.applicants} />
                    <Metric label="Sched" value={r.scheduled} />
                    <Metric label="Eval" value={r.evaluated} />
                    <Metric label="Won" value={r.onboarded} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-apex-faint">
                    <th className="px-5 py-3 w-14">#</th>
                    <th className="px-5 py-3">Agent</th>
                    <th className="px-3 py-3 text-right">Applicants</th>
                    <th className="px-3 py-3 text-right">Scheduled</th>
                    <th className="px-3 py-3 text-right">Evaluated</th>
                    <th className="px-3 py-3 text-right">Onboarded</th>
                    <th className="px-5 py-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {rows.map((r: any, i: number) => (
                    <tr key={r.user_id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-apex-faint">{i + 1}</td>
                      <td className="px-5 py-3 text-apex-ivory">{r.profile?.first_name} {r.profile?.last_name}</td>
                      <td className="px-3 py-3 text-right text-apex-dim">{r.applicants}</td>
                      <td className="px-3 py-3 text-right text-apex-dim">{r.scheduled}</td>
                      <td className="px-3 py-3 text-right text-apex-dim">{r.evaluated}</td>
                      <td className="px-3 py-3 text-right text-apex-dim">{r.onboarded}</td>
                      <td className="px-5 py-3 text-right font-semibold text-apex-gold">{r.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </PortalShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-black/40 py-2">
      <div className="font-display text-lg text-apex-ivory">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-apex-faint">{label}</div>
    </div>
  );
}
