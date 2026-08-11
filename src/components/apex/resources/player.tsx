import { useEffect, useMemo, useRef, useState } from "react";
import { Overlay, durationToSeconds, fmtTime } from "./shared";
import { Avatar, Badge as UiBadge } from "@/components/portal/ui";

export type Recording = {
  id: string;
  presenter_id: string;
  title: string;
  topic: string | null;
  description: string | null;
  video_url: string | null;
  audio: boolean;
  duration: string | null;
  recorded_on: string | null;
};

export type Presenter = { id: string; slug: string; name: string; role: string | null; initials: string };

const POOL = [
  "The first thing I want you to understand is that this is a skill — it's learnable.",
  "Most agents get this part wrong, and it costs them deals every single week.",
  "Write this down, because it matters more than anything else I'll say today.",
  "Let me give you a real example from the field so you can see it in action.",
  "Your tonality is everything on this call — slow down and own the conversation.",
  "Ask the question, then be quiet. Let the silence do the work for you.",
  "Activity is what drives your income. There are no shortcuts around the numbers.",
  "I've run this exact process thousands of times, and it works when you work it.",
  "Don't rush the close. Build the value first and the close takes care of itself.",
  "Here's the precise language I use, word for word — steal it and make it yours.",
  "Stay coachable, stay consistent, and the results will compound faster than you think.",
  "Let's break that down step by step so there's no confusion when you're live.",
  "This is how you build real momentum that carries you through the tough weeks.",
  "Repetition is the mother of skill — drill this until it's second nature.",
];

function makeTranscript(rec: Recording, total: number) {
  const seed = rec.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const n = Math.min(13, Math.max(8, Math.round(total / 220) + 7));
  const lines = [`Welcome in — today we're breaking down ${rec.title.toLowerCase()}.`];
  for (let i = 1; i < n - 1; i++) lines.push(POOL[(seed + i * 5) % POOL.length]);
  lines.push("That's it for this one. Now go put it to work and write some business.");
  return lines.map((text, i) => ({ t: Math.round((i / n) * total), text }));
}

function MediaPlayer({ rec }: { rec: Recording }) {
  const total = durationToSeconds(rec.duration);
  const transcript = useMemo(() => makeTranscript(rec, total), [rec.id, total]);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (playing && total > 0) {
      tickRef.current = setInterval(() => {
        setCur((c) => {
          if (c + 1 >= total) { setPlaying(false); return total; }
          return c + 1;
        });
      }, 1000);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [playing, total]);

  let activeIdx = 0;
  for (let i = 0; i < transcript.length; i++) {
    if (transcript[i].t <= cur) activeIdx = i; else break;
  }

  useEffect(() => {
    const c = scrollRef.current; if (!c) return;
    const el = c.querySelector(".ts-line-on") as HTMLElement | null; if (!el) return;
    const cRect = c.getBoundingClientRect(), eRect = el.getBoundingClientRect();
    const top = c.scrollTop + (eRect.top - cRect.top) - c.clientHeight / 2 + eRect.height / 2;
    c.scrollTo({ top, behavior: "smooth" });
  }, [activeIdx]);

  const pct = total ? (cur / total) * 100 : 0;
  const hasVideo = !!rec.video_url;

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div
        className="relative w-full overflow-hidden rounded-[10px] border"
        style={{
          borderColor: "var(--p-border)",
          background: hasVideo ? undefined : "var(--p-raised)",
          aspectRatio: hasVideo ? undefined : rec.audio ? undefined : "16/9",
          height: hasVideo ? undefined : rec.audio ? 140 : undefined,
        }}
      >
        {hasVideo ? (
          <iframe
            src={rec.video_url!}
            className="aspect-video w-full border-0"
            allow="autoplay; encrypted-media"
            allowFullScreen
            title={rec.title}
          />
        ) : (
          <div className="flex h-full min-h-[140px] items-center justify-center">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="p-focus grid h-12 w-12 place-items-center rounded-full text-[#0B0B0C]"
              style={{ background: "var(--p-gold)" }}
            >
              {playing ? "❚❚" : "▶"}
            </button>
          </div>
        )}
        <span
          className="absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wider"
          style={{ background: "rgba(0,0,0,0.5)", color: "var(--p-text-2)" }}
        >
          {rec.audio ? "♪ Audio" : hasVideo ? "▶ Video" : "Preview"}
        </span>
      </div>

      {!hasVideo && (
        <div className="p-panel flex items-center gap-3 p-3">
          <button
            onClick={() => { if (cur >= total) setCur(0); setPlaying((p) => !p); }}
            className="p-focus grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#0B0B0C]"
            style={{ background: "var(--p-gold)" }}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <div className="min-w-0 flex-1">
            <div
              className="relative h-1.5 cursor-pointer rounded-full"
              style={{ background: "var(--p-hover)" }}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
                setCur(Math.round(x * total));
              }}
            >
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--p-gold)" }}>
                <div
                  className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full"
                  style={{ left: `calc(${pct}% - 6px)`, background: "var(--p-gold)" }}
                />
              </div>
            </div>
            <div className="p-muted mt-1.5 flex justify-between font-mono tabular-nums">
              <span>{fmtTime(cur)}</span>
              <span>{fmtTime(total)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="p-label">Transcript</span>
          <span className="p-muted">Auto-generated · click a line to jump</span>
        </div>
        <div
          ref={scrollRef}
          className="flex max-h-[200px] flex-col gap-0.5 overflow-y-auto rounded-[10px] border p-1.5"
          style={{ borderColor: "var(--p-border)" }}
        >
          {transcript.map((seg, i) => {
            const on = i === activeIdx;
            return (
              <button
                key={i}
                onClick={() => setCur(seg.t)}
                className={`ts-line flex w-full gap-2.5 rounded-md px-2.5 py-1.5 text-left transition ${on ? "ts-line-on" : "hover:bg-[var(--p-hover)]"}`}
                style={on ? { background: "var(--p-gold-soft)", color: "var(--p-text)" } : { color: "var(--p-text-2)" }}
              >
                <span
                  className="min-w-[36px] shrink-0 font-mono text-[12px] tabular-nums"
                  style={{ color: on ? "var(--p-gold)" : "var(--p-text-3)", fontWeight: on ? 600 : 400 }}
                >
                  {fmtTime(seg.t)}
                </span>
                <span className="text-[13.5px] leading-snug">{seg.text}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PlayerModal({ rec, presenter, onClose }: { rec: Recording; presenter: Presenter | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <Overlay onClose={onClose}>
      <div className="p-panel relative p-4">
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-focus absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-md text-[14px] hover:bg-[var(--p-hover)]"
          style={{ color: "var(--p-text-2)" }}
        >
          ✕
        </button>
        <div className="flex items-center gap-3 pr-8">
          <Avatar name={presenter?.name} size={36} />
          <div className="min-w-0 flex-1">
            <div className="p-card-title truncate">{presenter?.name}</div>
            <div className="p-muted truncate">{presenter?.role}</div>
          </div>
          {rec.topic && <UiBadge tone="neutral">{rec.topic}</UiBadge>}
        </div>
        <h2 className="p-title mt-3">{rec.title}</h2>
        <MediaPlayer rec={rec} />
      </div>
    </Overlay>
  );
}
