import { useEffect, useMemo, useState } from "react";
import { Badge, TYPE_META, formatDisplayDate, Overlay } from "./shared";

export type LibraryItem = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  long: string | null;
  url: string | null;
  cta: string | null;
  meta: string | null;
  tags: string[] | null;
  display_date: string | null;
};

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "video", label: "Videos" },
  { key: "pdf", label: "PDFs" },
  { key: "training", label: "Trainings" },
  { key: "guide", label: "Guides" },
];

export function LibraryView({ items }: { items: LibraryItem[] }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<LibraryItem | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const f of FILTERS) if (f.key !== "all") c[f.key] = items.filter((r) => r.type === f.key).length;
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((r) => {
      if (filter !== "all" && r.type !== filter) return false;
      if (!q) return true;
      const hay = (r.title + " " + (r.description ?? "") + " " + (r.tags ?? []).join(" ")).toLowerCase();
      return hay.includes(q);
    });
  }, [items, filter, query]);

  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-6 pt-8 pb-8 md:pt-14">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-apex-gold">Resource Library</p>
          <h1 className="mt-3 font-display text-[clamp(32px,5vw,52px)] leading-[0.98] tracking-[0.01em]">
            Scripts, guides &amp; trainings.
          </h1>
        </div>
        <div className="flex h-10 w-full max-w-[320px] items-center gap-2 rounded-lg border border-white/[0.09] bg-[#131313] px-3 focus-within:border-apex-gold/60 focus-within:shadow-[0_0_0_3px_rgba(201,168,76,0.13)]">
          <span className="text-apex-dim">⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search resources…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-apex-faint"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-apex-dim hover:text-apex-ivory">✕</button>
          )}
        </div>
      </section>

      <div className="mb-9 flex flex-nowrap gap-1 overflow-x-auto border-b border-white/[0.09]">
        {FILTERS.filter((f) => f.key === "all" || (counts[f.key] ?? 0) > 0).map((f) => {
          const on = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`relative inline-flex items-center gap-2 whitespace-nowrap px-4 py-3 text-[14px] font-semibold transition ${
                on ? "text-apex-ivory" : "text-apex-dim hover:text-apex-ivory"
              }`}
            >
              {f.label}
              <span
                className={`inline-flex min-w-[22px] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  on ? "bg-apex-gold/15 text-apex-gold" : "bg-white/[0.06] text-apex-faint"
                }`}
              >
                {counts[f.key] ?? 0}
              </span>
              {on && <span className="absolute inset-x-4 -bottom-px h-0.5 bg-apex-gold" />}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.09] bg-[#131313] p-14 text-center">
          <p className="font-display text-2xl">No resources found</p>
          <p className="mt-1 text-[13px] text-apex-dim">Try a different search or filter.</p>
        </div>
      ) : (
        <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(312px,1fr))]">
          {visible.map((it) => <Card key={it.id} item={it} onOpen={() => setActive(it)} />)}
        </div>
      )}

      {active && <ItemModal item={active} onClose={() => setActive(null)} />}
    </>
  );
}

function Card({ item, onOpen }: { item: LibraryItem; onOpen: () => void }) {
  const color = (TYPE_META[item.type] ?? TYPE_META.guide).color;
  return (
    <button
      onClick={onOpen}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-[14px] border border-white/[0.09] bg-[#131313] p-[22px] text-left transition hover:-translate-y-[3px] hover:border-white/25"
    >
      <span
        className="absolute inset-y-0 left-0 w-[3px] opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: color }}
      />
      <div className="flex items-center justify-between">
        <Badge type={item.type} />
        <span className="text-[12px] text-apex-faint">{formatDisplayDate(item.display_date)}</span>
      </div>
      <h3 className="font-display text-[26px] leading-[1.02] tracking-[0.012em]">{item.title}</h3>
      <p className="line-clamp-3 text-[14.5px] leading-[1.55] text-apex-dim">{item.description}</p>
      <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-[14px]">
        <span className="text-[12.5px] text-apex-faint">{item.meta}</span>
        <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-apex-gold">
          {item.cta ?? "Open"}
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </span>
      </div>
    </button>
  );
}

function ItemModal({ item, onClose }: { item: LibraryItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  const color = (TYPE_META[item.type] ?? TYPE_META.guide).color;
  return (
    <Overlay onClose={onClose}>
      <div
        className="relative rounded-[18px] border border-white/[0.09] bg-[#131313] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
        style={{ borderTopColor: color, borderTopWidth: 2 }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-apex-dim hover:border-white/30 hover:text-apex-ivory"
          aria-label="Close"
        >
          ✕
        </button>
        <div className="flex items-center justify-between pr-10">
          <Badge type={item.type} size="md" />
          <span className="text-[12.5px] text-apex-faint">{formatDisplayDate(item.display_date)}</span>
        </div>
        <h2 className="mt-5 font-display text-[clamp(30px,4.4vw,44px)] leading-[1.02]">{item.title}</h2>
        <p className="mt-4 text-[15px] leading-[1.6] text-apex-dim">{item.long || item.description}</p>
        {item.tags && item.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {item.tags.map((t) => (
              <span key={t} className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[11.5px] text-apex-dim">
                #{t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5">
          <span className="text-[12.5px] text-apex-faint">{item.meta}</span>
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-apex-gold px-4 py-2.5 text-[14px] font-bold text-black transition hover:brightness-110"
            >
              {item.cta ?? "Open"} <span>→</span>
            </a>
          ) : (
            <span className="text-[13px] text-apex-faint">Link coming soon</span>
          )}
        </div>
      </div>
    </Overlay>
  );
}
