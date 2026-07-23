import type { ReactNode } from "react";

export const TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  video:    { label: "Video",    color: "#E5484D", icon: "▶" },
  pdf:      { label: "PDF",      color: "#4C7DF0", icon: "▤" },
  training: { label: "Training", color: "#C9A84C", icon: "★" },
  guide:    { label: "Guide",    color: "#46A758", icon: "▦" },
  course:   { label: "Course",   color: "#C9A84C", icon: "◈" },
};

export function formatDisplayDate(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function Badge({ type, size = "sm" }: { type: string; size?: "sm" | "md" }) {
  const m = TYPE_META[type] ?? TYPE_META.guide;
  const pad = size === "md" ? "px-3 py-1.5 text-[11.5px]" : "px-2.5 py-1 text-[10.5px]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-[0.14em] ${pad}`}
      style={{ borderColor: `${m.color}55`, background: `${m.color}12`, color: m.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

export function SectionKicker({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-apex-gold">
      {children}
    </p>
  );
}

/** Overlay + centered modal shell. */
export function Overlay({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/72 px-4 py-10 backdrop-blur-sm"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[720px]">
        {children}
      </div>
    </div>
  );
}

export function durationToSeconds(d?: string | null) {
  if (!d) return 0;
  const parts = d.split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
}

export function fmtTime(s: number) {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, "0")}`;
}
