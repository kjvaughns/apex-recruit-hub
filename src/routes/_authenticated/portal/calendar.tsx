import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/apex/portal-shell";
import { PageHeader, PageBody, Toolbar, ToolbarSpacer, SegmentedControl, Button } from "@/components/portal/ui";
import { getCalendar } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/portal/calendar")({
  head: () => ({ meta: [{ title: "Calendar — Vantage Portal" }, { name: "robots", content: "noindex" }] }),
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
      <PageBody>
        <PageHeader title="Calendar" description="Appointments and tasks across your pipeline." />

        <Toolbar className="mb-4">
          <SegmentedControl
            size="sm"
            options={[
              { value: "mine", label: "Mine" },
              { value: "all", label: "All" },
            ]}
            value={scope}
            onChange={(v) => setScope(v as Scope)}
          />
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              ←
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              →
            </Button>
          </div>
          <span className="p-card-title ml-2">{monthLabel}</span>
          <ToolbarSpacer />
          <div className="p-muted flex items-center gap-3 text-[11.5px]">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--p-gold)" }} />
              Appointments
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--p-green)" }} />
              Tasks
            </span>
          </div>
        </Toolbar>

        <div
          className="grid grid-cols-7 gap-px overflow-hidden rounded-[10px] border"
          style={{ borderColor: "var(--p-border)", background: "var(--p-border)" }}
        >
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="p-label px-2 py-2 uppercase tracking-[0.08em]"
              style={{ background: "var(--p-hover)" }}
            >
              {d}
            </div>
          ))}
          {days.map((d, i) => {
            if (!d) return <div key={i} className="min-h-[110px]" style={{ background: "var(--p-panel)" }} />;
            const events = byDay[d.toDateString()] ?? [];
            const isToday = d.toDateString() === today;
            return (
              <div
                key={i}
                className="min-h-[110px] p-2"
                style={{
                  background: "var(--p-panel)",
                  boxShadow: isToday ? "inset 0 0 0 1px var(--p-gold)" : undefined,
                }}
              >
                <div
                  className="text-[12px] font-semibold"
                  style={{ color: isToday ? "var(--p-gold)" : "var(--p-text)" }}
                >
                  {d.getDate()}
                </div>
                <div className="mt-1 space-y-1">
                  {events.slice(0, 3).map((e) => (
                    <div
                      key={e.kind + e.id}
                      className="truncate rounded px-1.5 py-0.5 text-[10.5px] font-medium"
                      style={
                        e.kind === "appt"
                          ? { background: "var(--p-gold-soft)", color: "var(--p-gold)" }
                          : { background: "rgba(63,179,127,0.12)", color: "var(--p-green)" }
                      }
                    >
                      {e.time} · {e.label}
                    </div>
                  ))}
                  {events.length > 3 && <div className="p-muted text-[10px]">+{events.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>

        {q.isLoading && <div className="p-muted mt-4 text-center">Loading…</div>}
      </PageBody>
    </PortalShell>
  );
}
