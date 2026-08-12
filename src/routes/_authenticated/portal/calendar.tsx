import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { PageHeader, PageBody, Toolbar, ToolbarSpacer, SegmentedControl, Button, Badge, Modal } from "@/components/portal/ui";
import { getCalendar, toggleTask, deleteTask } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/portal/calendar")({
  head: () => ({ meta: [{ title: "Calendar — Vantage Portal" }, { name: "robots", content: "noindex" }] }),
  component: CalendarPage,
});

type Scope = "mine" | "all";
type View = "month" | "week" | "day";

type CalEvent = {
  key: string;
  kind: "appt" | "task";
  label: string;
  start: Date;
  time: string;
  applicantId?: string;
  taskId?: string;
  completed?: boolean;
  priority?: string;
};

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59); }
function startOfWeek(d: Date) { const x = new Date(d); x.setDate(d.getDate() - d.getDay()); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(d.getDate() + n); return x; }
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function timeStr(d: Date) { return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

function CalendarPage() {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [scope, setScope] = useState<Scope>("mine");
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const fn = useServerFn(getCalendar);

  const range = useMemo(() => {
    if (view === "day") return { from: startOfDay(cursor), to: endOfDay(cursor) };
    if (view === "week") { const s = startOfWeek(cursor); return { from: s, to: endOfDay(addDays(s, 6)) }; }
    return { from: startOfMonth(cursor), to: endOfMonth(cursor) };
  }, [view, cursor]);

  const q = useQuery({
    queryKey: ["calendar", range.from.toISOString(), range.to.toISOString(), scope],
    queryFn: () => fn({ data: { from: range.from.toISOString(), to: range.to.toISOString(), scope } }),
  });

  const events = useMemo(() => {
    const out: CalEvent[] = [];
    for (const a of q.data?.appointments ?? []) {
      const dt = new Date(a.calendly_scheduled_at as string);
      out.push({
        key: `appt-${a.id}`,
        kind: "appt",
        label: `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || "Applicant",
        start: dt,
        time: timeStr(dt),
        applicantId: a.id,
      });
    }
    for (const t of q.data?.tasks ?? []) {
      if (!t.due_at) continue;
      const dt = new Date(t.due_at);
      out.push({
        key: `task-${t.id}`,
        kind: "task",
        label: t.title,
        start: dt,
        time: timeStr(dt),
        taskId: t.id,
        completed: !!t.completed_at,
        priority: t.priority,
      });
    }
    out.sort((a, b) => a.start.getTime() - b.start.getTime());
    return out;
  }, [q.data]);

  const byDay = useMemo(() => {
    const m: Record<string, CalEvent[]> = {};
    for (const e of events) (m[e.start.toDateString()] ??= []).push(e);
    return m;
  }, [events]);

  function shift(dir: -1 | 1) {
    if (view === "day") setCursor(addDays(cursor, dir));
    else if (view === "week") setCursor(addDays(cursor, dir * 7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1));
  }
  const rangeLabel =
    view === "day"
      ? cursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
      : view === "week"
        ? `Week of ${startOfWeek(cursor).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
        : cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <PortalShell>
      <PageBody>
        <PageHeader title="Calendar" description="Appointments and tasks across your pipeline." />

        <Toolbar className="mb-4">
          <SegmentedControl
            size="sm"
            options={[{ value: "month", label: "Month" }, { value: "week", label: "Week" }, { value: "day", label: "Day" }]}
            value={view}
            onChange={(v) => setView(v as View)}
          />
          <SegmentedControl
            size="sm"
            options={[{ value: "mine", label: "Mine" }, { value: "all", label: "All" }]}
            value={scope}
            onChange={(v) => setScope(v as Scope)}
          />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => shift(-1)}>←</Button>
            <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
            <Button variant="ghost" size="sm" onClick={() => shift(1)}>→</Button>
          </div>
          <span className="p-card-title ml-2">{rangeLabel}</span>
          <ToolbarSpacer />
          <div className="p-muted flex items-center gap-3 text-[11.5px]">
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--p-gold)" }} /> Appointments</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--p-green)" }} /> Tasks</span>
          </div>
        </Toolbar>

        {view === "month" && <MonthView cursor={cursor} byDay={byDay} onSelect={setSelected} />}
        {view === "week" && <WeekView cursor={cursor} byDay={byDay} onSelect={setSelected} />}
        {view === "day" && <DayView cursor={cursor} byDay={byDay} onSelect={setSelected} />}

        {q.isLoading && <div className="p-muted mt-4 text-center">Loading…</div>}
      </PageBody>

      {selected && <EventModal event={selected} onClose={() => setSelected(null)} />}
    </PortalShell>
  );
}

function Chip({ e, onSelect, compact }: { e: CalEvent; onSelect: (e: CalEvent) => void; compact?: boolean }) {
  return (
    <button
      onClick={() => onSelect(e)}
      className={`flex w-full items-center gap-1.5 truncate rounded ${compact ? "px-1.5 py-0.5 text-[10.5px]" : "px-2.5 py-2 text-[13px]"} text-left font-medium transition hover:brightness-110`}
      style={e.kind === "appt" ? { background: "var(--p-gold-soft)", color: "var(--p-gold)" } : { background: "rgba(63,179,127,0.12)", color: "var(--p-green)" }}
    >
      <span className="shrink-0 tabular-nums">{e.time}</span>
      <span className={`min-w-0 truncate ${e.completed ? "line-through opacity-70" : ""}`}>{e.label}</span>
    </button>
  );
}

function MonthView({ cursor, byDay, onSelect }: { cursor: Date; byDay: Record<string, CalEvent[]>; onSelect: (e: CalEvent) => void }) {
  const today = new Date().toDateString();
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

  return (
    <>
      {/* Mobile agenda */}
      <div className="space-y-2 sm:hidden">
        {days.filter((d): d is Date => !!d && (byDay[d.toDateString()]?.length ?? 0) > 0).length === 0 ? (
          <div className="p-panel p-6 text-center"><span className="p-muted">No appointments or tasks this month.</span></div>
        ) : (
          days.filter((d): d is Date => !!d && (byDay[d.toDateString()]?.length ?? 0) > 0).map((d) => (
            <div key={d.toISOString()} className="p-panel p-3">
              <div className="mb-2 text-[14px] font-semibold" style={{ color: d.toDateString() === today ? "var(--p-gold)" : "var(--p-text)" }}>
                {d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </div>
              <div className="space-y-1.5">{(byDay[d.toDateString()] ?? []).map((e) => <Chip key={e.key} e={e} onSelect={onSelect} />)}</div>
            </div>
          ))
        )}
      </div>

      {/* Desktop grid */}
      <div className="hidden grid-cols-7 gap-px overflow-hidden rounded-[10px] border sm:grid" style={{ borderColor: "var(--p-border)", background: "var(--p-border)" }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="p-label px-2 py-2 uppercase tracking-[0.08em]" style={{ background: "var(--p-hover)" }}>{d}</div>
        ))}
        {days.map((d, i) => {
          if (!d) return <div key={i} className="min-h-[110px]" style={{ background: "var(--p-panel)" }} />;
          const events = byDay[d.toDateString()] ?? [];
          const isToday = d.toDateString() === today;
          return (
            <div key={i} className="min-h-[110px] p-2" style={{ background: "var(--p-panel)", boxShadow: isToday ? "inset 0 0 0 1px var(--p-gold)" : undefined }}>
              <div className="text-[12px] font-semibold" style={{ color: isToday ? "var(--p-gold)" : "var(--p-text)" }}>{d.getDate()}</div>
              <div className="mt-1 space-y-1">
                {events.slice(0, 3).map((e) => <Chip key={e.key} e={e} onSelect={onSelect} compact />)}
                {events.length > 3 && <div className="p-muted text-[10px]">+{events.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function WeekView({ cursor, byDay, onSelect }: { cursor: Date; byDay: Record<string, CalEvent[]>; onSelect: (e: CalEvent) => void }) {
  const today = new Date().toDateString();
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-7 sm:gap-px sm:overflow-hidden sm:rounded-[10px] sm:border" style={{ borderColor: "var(--p-border)", background: "var(--p-border)" }}>
      {days.map((d) => {
        const events = byDay[d.toDateString()] ?? [];
        const isToday = d.toDateString() === today;
        return (
          <div key={d.toISOString()} className="p-panel min-h-[160px] p-2 sm:rounded-none sm:border-0">
            <div className="mb-1.5 text-[12px] font-semibold" style={{ color: isToday ? "var(--p-gold)" : "var(--p-text)" }}>
              {d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
            </div>
            <div className="space-y-1">
              {events.length === 0 ? <div className="p-muted text-[11px]">—</div> : events.map((e) => <Chip key={e.key} e={e} onSelect={onSelect} compact />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({ cursor, byDay, onSelect }: { cursor: Date; byDay: Record<string, CalEvent[]>; onSelect: (e: CalEvent) => void }) {
  const events = byDay[cursor.toDateString()] ?? [];
  return (
    <div className="p-panel p-4">
      {events.length === 0 ? (
        <div className="p-muted py-6 text-center">Nothing scheduled for this day.</div>
      ) : (
        <div className="space-y-2">{events.map((e) => <Chip key={e.key} e={e} onSelect={onSelect} />)}</div>
      )}
    </div>
  );
}

function EventModal({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toggle = useServerFn(toggleTask);
  const del = useServerFn(deleteTask);

  async function markDone() {
    if (!event.taskId) return;
    await toggle({ data: { id: event.taskId, done: !event.completed } });
    qc.invalidateQueries({ queryKey: ["calendar"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    onClose();
  }
  async function remove() {
    if (!event.taskId) return;
    await del({ data: { id: event.taskId } });
    qc.invalidateQueries({ queryKey: ["calendar"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    onClose();
  }

  return (
    <Modal
      title={event.label}
      description={event.kind === "appt" ? "Appointment" : "Task"}
      width={440}
      onClose={onClose}
      footer={
        event.kind === "appt" ? (
          <>
            <Button variant="ghost" onClick={onClose}>Close</Button>
            {event.applicantId && (
              <Button variant="primary" onClick={() => { onClose(); navigate({ to: "/portal/applicants", search: { open: event.applicantId } }); }}>
                Open applicant →
              </Button>
            )}
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={remove}>Delete</Button>
            <Button variant="primary" onClick={markDone}>{event.completed ? "Mark open" : "Mark complete"}</Button>
          </>
        )
      }
    >
      <dl className="grid gap-3 text-[13px]">
        <Row label="Type" value={event.kind === "appt" ? "Appointment" : "Task"} />
        <Row label="Date" value={event.start.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} />
        <Row label="Time" value={event.time} />
        {event.kind === "appt" && <Row label="Related applicant" value={event.label} />}
        {event.kind === "task" && event.priority && <Row label="Priority" value={event.priority} />}
        {event.kind === "task" && (
          <div className="flex items-center gap-2">
            <span className="p-label">Status</span>
            <Badge tone={event.completed ? "green" : "amber"}>{event.completed ? "Done" : "Open"}</Badge>
          </div>
        )}
      </dl>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="p-label mb-0.5">{label}</div>
      <div className="p-body capitalize">{value}</div>
    </div>
  );
}
