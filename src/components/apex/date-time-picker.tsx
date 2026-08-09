import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

// A dark, Vantage-styled date + time picker with shortcuts. Emits an ISO string
// (local time preserved) or null for "no due date". Renders as a centered
// modal/sheet so it works cleanly on mobile.

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? 0 : 30;
  return { value: h * 60 + m, label: fmtTime(h, m) };
});

function fmtTime(h: number, m: number) {
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function nextBusinessDay(from: Date) {
  let d = addDays(from, 1);
  while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
  return d;
}

export function summarizeDue(iso: string | null, allDay?: boolean): string {
  if (!iso) return "No due date";
  const d = new Date(iso);
  const datePart = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (allDay) return `Due ${datePart} · All day`;
  const timePart = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return `Due ${datePart} at ${timePart}`;
}

export function DateTimePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (iso: string | null, allDay: boolean) => void;
}) {
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "local", []);
  const initial = value ? new Date(value) : null;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(startOfDay(initial ?? new Date()));
  const [selected, setSelected] = useState<Date | null>(initial ? startOfDay(initial) : null);
  const [minutes, setMinutes] = useState<number>(
    initial ? initial.getHours() * 60 + initial.getMinutes() : 9 * 60,
  );
  const [allDay, setAllDay] = useState(false);
  const [displayAllDay, setDisplayAllDay] = useState(false);

  const cells = useMemo(() => buildMonth(view), [view]);
  const today = startOfDay(new Date());

  function commit(date: Date | null, mins: number, isAllDay: boolean) {
    if (!date) {
      onChange(null, false);
      setDisplayAllDay(false);
      setOpen(false);
      return;
    }
    const out = new Date(date);
    if (isAllDay) out.setHours(9, 0, 0, 0);
    else out.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    onChange(out.toISOString(), isAllDay);
    setDisplayAllDay(isAllDay);
    setOpen(false);
  }

  function pickShortcut(kind: "today" | "tomorrow" | "nextBiz" | "nextWeek" | "none") {
    if (kind === "none") {
      setSelected(null);
      commit(null, minutes, false);
      return;
    }
    const base =
      kind === "today"
        ? today
        : kind === "tomorrow"
          ? addDays(today, 1)
          : kind === "nextBiz"
            ? nextBusinessDay(today)
            : addDays(today, 7);
    setSelected(base);
    setView(startOfDay(base));
  }

  const candidate = selected ? withTime(selected, allDay ? 9 * 60 : minutes) : null;
  const isPast = candidate ? candidate.getTime() < Date.now() : false;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="apx-input flex items-center justify-between text-left"
      >
        <span className={cn(!value && "text-apex-faint")}>
          {summarizeDue(value, displayAllDay)}
        </span>
        <span className="text-apex-muted">📅</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="apx-card w-full max-w-[380px] rounded-b-none rounded-t-2xl p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Shortcuts */}
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                ["Today", "today"],
                ["Tomorrow", "tomorrow"],
                ["Next business day", "nextBiz"],
                ["Next week", "nextWeek"],
              ].map(([label, kind]) => (
                <button
                  key={kind}
                  onClick={() => pickShortcut(kind as any)}
                  className="rounded-full border border-white/10 px-2.5 py-1 text-[11.5px] text-apex-dim transition hover:border-apex-gold/40 hover:text-apex-gold"
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => pickShortcut("none")}
                className="rounded-full border border-white/10 px-2.5 py-1 text-[11.5px] text-apex-faint transition hover:border-white/25 hover:text-apex-ivory"
              >
                No due date
              </button>
            </div>

            {/* Month nav */}
            <div className="mb-2 flex items-center justify-between">
              <button
                onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
                className="h-8 w-8 rounded-lg border border-white/10 text-apex-dim hover:border-apex-gold/40 hover:text-apex-gold"
              >
                ‹
              </button>
              <div className="font-display text-[18px] text-apex-ivory">
                {MONTHS[view.getMonth()]} {view.getFullYear()}
              </div>
              <button
                onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
                className="h-8 w-8 rounded-lg border border-white/10 text-apex-dim hover:border-apex-gold/40 hover:text-apex-gold"
              >
                ›
              </button>
            </div>

            {/* Weekday labels */}
            <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-apex-faint">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((c, i) => {
                if (!c) return <div key={i} />;
                const isSel = selected && sameDay(c, selected);
                const isToday = sameDay(c, today);
                const isPastDay = c < today;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      setSelected(c);
                    }}
                    className={cn(
                      "flex h-9 items-center justify-center rounded-lg text-[13px] transition",
                      isSel
                        ? "bg-apex-gold font-semibold text-apex-card"
                        : "text-apex-fog hover:bg-white/[0.06]",
                      !isSel && isToday && "border border-apex-gold/50 text-apex-gold",
                      !isSel && isPastDay && "text-apex-faint",
                    )}
                  >
                    {c.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Time + all day */}
            <div className="mt-4 flex items-center gap-3">
              <select
                value={minutes}
                disabled={allDay}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="apx-input h-10 flex-1 text-[13px] disabled:opacity-50"
              >
                {TIME_SLOTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 text-[13px] text-apex-dim">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                />
                All day
              </label>
            </div>

            <div className="mt-2 text-[11.5px] text-apex-faint">Time zone: {tz}</div>
            {isPast && (
              <div className="mt-2 rounded-[8px] border border-amber-500/30 bg-amber-500/10 p-2 text-[12px] text-amber-200">
                Heads up — this date and time is in the past.
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  setSelected(null);
                  commit(null, minutes, false);
                }}
                className="apx-btn-ghost flex-1 px-4 py-2.5 text-[13px]"
              >
                Clear
              </button>
              <button
                onClick={() => commit(selected, minutes, allDay)}
                disabled={!selected}
                className="apx-btn-primary flex-1 px-4 py-2.5 text-[13px] disabled:opacity-50"
              >
                Set due date
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function withTime(date: Date, minutes: number) {
  const d = new Date(date);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

function buildMonth(view: Date): (Date | null)[] {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++)
    cells.push(new Date(view.getFullYear(), view.getMonth(), day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
