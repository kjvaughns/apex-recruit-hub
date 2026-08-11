import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import { getDashboard, getMyOnboarding } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({ meta: [{ title: "Dashboard — Vantage Portal" }, { name: "robots", content: "noindex" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const fn = useServerFn(getDashboard);
  const navigate = useNavigate();
  const onbFn = useServerFn(getMyOnboarding);
  const onbQ = useQuery({ queryKey: ["my-onboarding"], queryFn: () => onbFn() });

  // Soft landing: a new agent with incomplete onboarding defaults to the
  // onboarding page. They can still navigate elsewhere from the sidebar.
  const needsOnboarding = !!onbQ.data?.hasOnboarding && !onbQ.data.complete;
  useEffect(() => {
    if (needsOnboarding) navigate({ to: "/portal/onboarding", replace: true });
  }, [needsOnboarding, navigate]);

  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fn() });

  if (needsOnboarding) {
    return (
      <PortalShell>
        <PortalHeader kicker="Welcome to Vantage" title="Getting you set up…" />
        <div className="p-10 text-[13px] text-apex-faint">Taking you to your onboarding checklist…</div>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <PortalHeader
        kicker="Command Center"
        title="Your empire, at a glance"
        actions={
          <Link to="/portal/crm" className="apx-btn-primary px-4 py-2.5 text-[13.5px]">
            Open Applicants →
          </Link>
        }
      />

      <div className="px-6 py-8 md:px-10">
        {isLoading ? (
          <SkeletonGrid />
        ) : (
          <>
            <div className="mb-6">
              <div className="apx-kicker mb-3">This month</div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Stat label="My Applicants" value={data?.counts.totalMine ?? 0} caption="Active in your book" />
                <Stat label="New This Week" value={data?.counts.newThisWeek ?? 0} caption="Fresh applicants" accent />
                <Stat label="Scheduled" value={data?.counts.scheduled30d ?? 0} caption="Overviews booked · 30d" />
                <Stat label="Evaluated" value={data?.counts.evaluated30d ?? 0} caption="Completed · 30d" />
              </div>
            </div>

            {(data?.needsFollowUp ?? []).length > 0 && (
              <div className="apx-card apx-card-gold mt-8 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display text-[22px] leading-none">
                    Needs follow-up this week
                  </h2>
                  <Link
                    to="/portal/crm"
                    className="text-[12px] text-apex-gold hover:underline"
                  >
                    Open Pre-Licensing →
                  </Link>
                </div>
                <p className="mb-4 text-[12.5px] text-apex-muted">
                  Hired but not yet licensed, and it's been more than a week (or never) since their
                  last check-in.
                </p>
                <div className="flex flex-col divide-y divide-[var(--apx-hairline)]">
                  {(data?.needsFollowUp ?? []).map((p) => {
                    const days = p.last_follow_up_at ? daysSince(p.last_follow_up_at) : null;
                    return (
                      <Link
                        key={p.id}
                        to="/portal/crm/$applicantId"
                        params={{ applicantId: p.id }}
                        className="flex items-center justify-between gap-3 py-2.5 transition hover:text-apex-gold"
                      >
                        <span className="text-[13.5px] text-apex-ivory">
                          {p.first_name} {p.last_name}
                        </span>
                        <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-300">
                          {days === null ? "Never followed up" : `${days}d overdue`}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              <div className="apx-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display text-[22px] leading-none">Pipeline snapshot</h2>
                  <Link to="/portal/pipeline" className="text-[12px] text-apex-gold hover:underline">View pipeline →</Link>
                </div>
                <div className="grid gap-2">
                  {(data?.stages ?? []).map((s) => {
                    const count = data?.stageCounts[s.id] ?? 0;
                    const max = Math.max(1, ...Object.values(data?.stageCounts ?? {}));
                    const pct = Math.max(4, (count / max) * 100);
                    return (
                      <div key={s.id} className="flex items-center gap-3">
                        <div className="w-40 flex-none text-[13px] text-apex-dim">{s.name}</div>
                        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--apx-hover)]">
                          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: s.color || "#C9A84C" }} />
                        </div>
                        <div className="w-10 flex-none text-right font-display text-[18px] text-apex-ivory">{count}</div>
                      </div>
                    );
                  })}
                  {(data?.stages ?? []).length === 0 && (
                    <div className="text-[13px] text-apex-faint">No pipeline stages configured yet.</div>
                  )}
                </div>
              </div>

              <div className="apx-card p-6">
                <h2 className="mb-4 font-display text-[22px] leading-none">Recent activity</h2>
                <div className="flex flex-col gap-3">
                  {(data?.feed ?? []).slice(0, 12).map((f) => {
                    const app = f.applicants as { first_name: string; last_name: string } | null;
                    const who = app ? `${app.first_name} ${app.last_name}` : "Applicant";
                    return (
                      <div key={f.id} className="flex items-start gap-3 border-b border-[var(--apx-hairline)] pb-3 last:border-0">
                        <div className="mt-1 h-2 w-2 flex-none rounded-full bg-apex-gold shadow-[0_0_8px_rgba(201,168,76,0.6)]" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] text-apex-ivory">
                            <span className="text-apex-gold">{eventLabel(f.event_type)}</span> — {who}
                          </div>
                          {f.summary && <div className="mt-0.5 truncate text-[12.5px] text-apex-faint">{f.summary}</div>}
                        </div>
                        <div className="text-[11px] text-apex-faint">{relative(f.created_at)}</div>
                      </div>
                    );
                  })}
                  {(data?.feed ?? []).length === 0 && (
                    <div className="text-[13px] text-apex-faint">No activity yet. Once applicants come in, they'll show up here.</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </PortalShell>
  );
}

function Stat({
  label,
  value,
  caption,
  accent,
}: {
  label: string;
  value: number;
  caption?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`${accent ? "apx-card apx-card-gold" : "apx-card"} group relative overflow-hidden p-6 transition-transform duration-200 hover:-translate-y-0.5`}
    >
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-apex-gold/0 via-apex-gold/70 to-apex-gold/0 opacity-70" />
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-apex-muted">
        {label}
      </div>
      <div
        className={`mt-3 font-display text-[52px] leading-none ${accent ? "text-apex-gold" : "text-apex-ivory"}`}
      >
        {value}
      </div>
      {caption && <div className="mt-1.5 text-[12px] text-apex-faint">{caption}</div>}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="apx-card h-[140px] animate-pulse" />
      ))}
    </div>
  );
}

function eventLabel(t: string) {
  const map: Record<string, string> = {
    application_submitted: "New application",
    evaluation_submitted: "Evaluation submitted",
    appointment_scheduled: "Appointment scheduled",
    stage_changed: "Stage updated",
    note: "Note added",
  };
  return map[t] ?? t.replace(/_/g, " ");
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
}

function relative(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dd = Math.floor(h / 24);
  return `${dd}d`;
}
