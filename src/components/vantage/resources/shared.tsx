import type { ReactNode } from "react";
import { Badge as UiBadge, type BadgeTone } from "@/components/portal/ui";

export const TYPE_META: Record<string, { label: string; color: string; icon: string; tone: BadgeTone }> = {
  video:    { label: "Video",    color: "#E5484D", icon: "▶", tone: "red" },
  pdf:      { label: "PDF",      color: "#4C7DF0", icon: "▤", tone: "blue" },
  training: { label: "Training", color: "#C9A84C", icon: "★", tone: "gold" },
  guide:    { label: "Guide",    color: "#46A758", icon: "▦", tone: "green" },
  course:   { label: "Course",   color: "#C9A84C", icon: "◈", tone: "gold" },
};

export function formatDisplayDate(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function Badge({ type, size = "sm" }: { type: string; size?: "sm" | "md" }) {
  const m = TYPE_META[type] ?? TYPE_META.guide;
  return (
    <UiBadge tone={m.tone} dot className={size === "md" ? "text-[12px]" : undefined}>
      {m.label}
    </UiBadge>
  );
}

export function SectionKicker({ children }: { children: ReactNode }) {
  return <p className="p-label mb-2">{children}</p>;
}

/** Overlay + centered modal shell. */
export function Overlay({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10 backdrop-blur-[2px]"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[640px]">
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
