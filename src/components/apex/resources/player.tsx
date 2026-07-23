import { useEffect, useMemo, useRef, useState } from "react";
import { Overlay, durationToSeconds, fmtTime } from "./shared";

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
    <div className="mt-6 flex flex-col gap-4">
      <div
        className={`relative w-full overflow-hidden rounded-xl border border-white/[0.09] ${
          hasVideo ? "" : "bg-[radial-gradient(circle_at_50%_42%,#1c1c1c,#101010)]"
        }`}
        style={hasVideo ? undefined : { aspectRatio: rec.audio ? undefined : "16/9", height: rec.audio ? 172 : undefined }}
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
          <div className="flex h-full min-h-[172px] items-center justify-center">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-apex-gold text-black shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition hover:brightness-110"
            >
              {playing ? "❚❚" : "▶"}
            </button>
          </div>
        )}
        <span className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-apex-faint">
          {rec.audio ? "♪ Audio" : hasVideo ? "▶ Video" : "Preview"}
        </span>
      </div>

      {!hasVideo && (
        <div className="flex items-center gap-4 rounded-xl border border-white/[0.09] bg-[#1a1a1a] p-4">
          <button
            onClick={() => { if (cur >= total) setCur(0); setPlaying((p) => !p); }}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-apex-gold text-black transition hover:brightness-110"
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <div className="min-w-0 flex-1">
            <div
              className="relative h-1.5 cursor-pointer rounded-full bg-white/10"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
                setCur(Math.round(x * total));
              }}
            >
              <div className="h-full rounded-full bg-apex-gold" style={{ width: `${pct}%` }}>
                <div className="absolute right-[-6px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-apex-gold shadow-[0_0_0_3px_rgba(201,168,76,0.22)]" style={{ left: `calc(${pct}% - 6px)` }} />
              </div>
            </div>
            <div className="mt-2 flex justify-between font-mono text-[12px] tabular-nums text-apex-dim">
              <span>{fmtTime(cur)}</span>
              <span>{fmtTime(total)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[12px] font-bold uppercase tracking-[0.14em]">Transcript</span>
          <span className="text-[11px] text-apex-faint">Auto-generated · click a line to jump</span>
        </div>
        <div
          ref={scrollRef}
          className="flex max-h-[230px] flex-col gap-0.5 overflow-y-auto rounded-xl border border-white/[0.09] p-1.5"
        >
          {transcript.map((seg, i) => {
            const on = i === activeIdx;
            return (
              <button
                key={i}
                onClick={() => setCur(seg.t)}
                className={`ts-line flex w-full gap-3 rounded-lg px-3 py-2 text-left transition ${
                  on ? "ts-line-on bg-apex-gold/[0.12] text-apex-ivory" : "text-apex-dim hover:bg-white/[0.04] hover:text-apex-ivory"
                }`}
              >
                <span className={`min-w-[38px] font-mono text-[12px] tabular-nums ${on ? "font-semibold text-apex-gold" : "text-apex-faint"}`}>
                  {fmtTime(seg.t)}
                </span>
                <span className="text-[14px] leading-[1.5]">{seg.text}</span>
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
      <div className="relative rounded-[18px] border border-white/[0.09] bg-[#131313] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-apex-dim hover:border-white/30 hover:text-apex-ivory"
          aria-label="Close"
        >
          ✕
        </button>
        <div className="flex items-center gap-3 pr-10">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-apex-gold/15 font-display text-lg text-apex-gold">
            {presenter?.initials ?? "?"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">{presenter?.name}</div>
            <div className="text-[12px] text-apex-faint">{presenter?.role}</div>
          </div>
          {rec.topic && (
            <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-widest text-apex-dim">
              {rec.topic}
            </span>
          )}
        </div>
        <h2 className="mt-5 font-display text-[clamp(28px,4vw,40px)] leading-[1.02]">{rec.title}</h2>
        <MediaPlayer rec={rec} />
      </div>
    </Overlay>
  );
}
