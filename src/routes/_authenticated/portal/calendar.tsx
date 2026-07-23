import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import { getCalendar } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/portal/calendar")({
  head: () => ({ meta: [{ title: "Calendar — APEX Portal" }, { name: "robots", content: "noindex" }] }),
  component: CalendarPage,
});

type Scope = "mine" | "all";

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59); }

function CalendarPage() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [scope, setScope] = useState<Scope>("mine");
  const fn = useServerFn(getCalendar);

  const from = startOfMonth(cursor).toISOString();
  const to = endOfMonth(cursor).toISOString();
  const q = useQuery({
    queryKey: ["calendar", from, to, scope],
    queryFn: () => fn({ data: { from, to, scope } }),
  });

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

  const days = useMemo(() => {
    const first = startOfMonth(cursor);
    const startDow = first.getDay();
    const daysInMonth = endOfMonth(cursor).getDate();
    const cells: Array<Date | null> = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [cursor]);

  const byDay = useMemo(() => {
    const m: Record<string, Array<{ kind: "appt" | "task"; label: string; time: string; id: string }>> = {};
    for (const a of q.data?.appointments ?? []) {
      const dt = new Date(a.calendly_scheduled_at as string);
      const k = dt.toDateString();
      (m[k] ??= []).push({
        kind: "appt",
        label: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || "Applicant",
        time: dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        id: a.id,
      });
    }
    for (const t of q.data?.tasks ?? []) {
      if (!t.due_at) continue;
      const dt = new Date(t.due_at);
      const k = dt.toDateString();
      (m[k] ??= []).push({
        kind: "task",
        label: t.title,
        time: dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        id: t.id,
      });
    }
    return m;
  }, [q.data]);

  const today = new Date().toDateString();

  return (
    <PortalShell>
      <PortalHeader
        kicker="Schedule"
        title="Calendar"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScope(scope === "mine" ? "all" : "mine")}
              className="apx-btn-ghost px-3 py-2 text-[12px]"
            >
              {scope === "mine" ? "Mine" : "All"}
            </button>
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="apx-btn-ghost px-3 py-2 text-[12px]"
            >
              ←
            </button>
            <button
              onClick={() => setCursor(startOfMonth(new Date()))}
              className="apx-btn-ghost px-3 py-2 text-[12px]"
            >
              Today
            </button>
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="apx-btn-ghost px-3 py-2 text-[12px]"
            >
              →
            </button>
          </div>
        }
      />
      <div className="px-6 py-8 md:px-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-display text-2xl">{monthLabel}</div>
          <div className="text-[11.5px] text-apex-faint">
            <span className="mr-3"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-apex-gold" />Appointments</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />Tasks</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04]">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
            <div key={d} className="bg-black/50 px-3 py-2 text-[10.5px] uppercase tracking-[0.2em] text-apex-faint">{d}</div>
          ))}
          {days.map((d, i) => {
            if (!d) return <div key={i} className="min-h-[110px] bg-black/40" />;
            const events = byDay[d.toDateString()] ?? [];
            const isToday = d.toDateString() === today;
            return (
              <div key={i} className={`min-h-[110px] bg-black/50 p-2 ${isToday ? "ring-1 ring-inset ring-apex-gold/40" : ""}`}>
                <div className={`text-[11.5px] ${isToday ? "text-apex-gold font-semibold" : "text-apex-dim"}`}>{d.getDate()}</div>
                <div className="mt-1 space-y-1">
                  {events.slice(0, 3).map((e) => (
                    <div key={e.kind + e.id} className={`truncate rounded px-1.5 py-0.5 text-[10.5px] ${e.kind === "appt" ? "bg-apex-gold/15 text-apex-gold" : "bg-emerald-500/10 text-emerald-300"}`}>
                      {e.time} · {e.label}
                    </div>
                  ))}
                  {events.length > 3 && <div className="text-[10px] text-apex-faint">+{events.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>

        {q.isLoading && <div className="mt-4 text-center text-apex-dim">Loading…</div>}
      </div>
    </PortalShell>
  );
}
