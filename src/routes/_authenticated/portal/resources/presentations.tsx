import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/apex/portal-shell";
import { listPresentersWithRecordings } from "@/lib/resources.functions";
import { PlayerModal, type Presenter, type Recording } from "@/components/apex/resources/player";
import { formatDisplayDate } from "@/components/apex/resources/shared";

export const Route = createFileRoute("/_authenticated/portal/resources/presentations")({
  head: () => ({ meta: [{ title: "Recorded Trainings — APEX Portal" }, { name: "robots", content: "noindex" }] }),
  component: PresentationsPage,
});

function PresentationsPage() {
  const fn = useServerFn(listPresentersWithRecordings);
  const q = useQuery({ queryKey: ["presentations"], queryFn: () => fn() });
  const presenters = (q.data?.presenters ?? []) as Presenter[];
  const recordings = (q.data?.recordings ?? []) as Recording[];

  const [sel, setSel] = useState<string | null>(null);
  const activeId = sel ?? presenters[0]?.id ?? null;
  const [active, setActive] = useState<Recording | null>(null);

  const list = useMemo(
    () => recordings.filter((r) => r.presenter_id === activeId),
    [recordings, activeId],
  );
  const activePresenter = presenters.find((p) => p.id === activeId) ?? null;

  return (
    <PortalShell>
      <div className="mx-auto max-w-[1240px] px-6 pb-20 md:px-8">
        <div className="flex items-center gap-4 pt-6">
          <Link
            to="/portal/resources"
            className="rounded-lg border border-white/[0.09] px-3 py-1.5 text-[13px] font-semibold text-apex-dim transition hover:border-apex-gold hover:text-apex-gold"
          >
            ← Hub
          </Link>
        </div>

        <section className="pt-10 pb-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-apex-gold">Recorded Presentations</p>
          <h1 className="mt-3 font-display text-[clamp(32px,5vw,52px)] leading-[0.98]">
            Hear it straight from the people closing business.
          </h1>
          <p className="mt-4 max-w-[620px] text-[16px] text-apex-dim">Pick a presenter to browse their recorded calls and trainings.</p>
        </section>

        {q.isLoading ? (
          <div className="py-16 text-center text-apex-dim">Loading…</div>
        ) : (
          <>
            {/* Presenter selector */}
            <div className="mb-8 flex flex-wrap gap-3">
              {presenters.map((p) => {
                const on = p.id === activeId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSel(p.id)}
                    className={`flex min-w-[140px] flex-col items-center gap-2 rounded-2xl border px-5 py-4 transition ${
                      on
                        ? "border-apex-gold bg-apex-gold/10"
                        : "border-white/[0.09] bg-[#131313] hover:border-white/25"
                    }`}
                  >
                    <span
                      className={`flex h-14 w-14 items-center justify-center rounded-full font-display text-2xl ${
                        on ? "bg-apex-gold text-black" : "bg-apex-gold/15 text-apex-gold"
                      }`}
                    >
                      {p.initials}
                    </span>
                    <span className="text-[14.5px] font-semibold text-apex-ivory">{p.name}</span>
                    {p.role && <span className="text-[11.5px] text-apex-faint">{p.role}</span>}
                  </button>
                );
              })}
            </div>

            {/* List head */}
            <div className="mb-4 flex items-baseline justify-between">
              <span className="font-display text-[24px] uppercase tracking-wider">{activePresenter?.name}</span>
              <span className="text-[12.5px] text-apex-faint">
                {list.length} recording{list.length === 1 ? "" : "s"}
              </span>
            </div>

            {list.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.09] bg-[#131313] p-14 text-center">
                <p className="font-display text-2xl">No recordings yet</p>
                <p className="mt-1 text-[13px] text-apex-dim">
                  {activePresenter?.name}'s recordings will appear here once they're added.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {list.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setActive(r)}
                    className="group flex items-center gap-4 rounded-xl border border-white/[0.09] bg-[#131313] px-4 py-3.5 text-left transition hover:-translate-y-0.5 hover:border-apex-gold"
                  >
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-apex-gold text-black transition group-hover:brightness-110">
                      ▶
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-apex-ivory">{r.title}</span>
                      <span className="mt-1 flex flex-wrap gap-2 text-[12.5px] text-apex-faint">
                        {r.topic && <span className="text-apex-dim">{r.topic}</span>}
                        <span className="text-white/15">·</span>
                        <span>{formatDisplayDate(r.recorded_on)}</span>
                        {r.video_url && (
                          <>
                            <span className="text-white/15">·</span>
                            <span className="text-apex-gold">{r.audio ? "♪ Audio" : "▶ Video"}</span>
                          </>
                        )}
                      </span>
                    </span>
                    <span className="hidden font-mono text-[13px] tabular-nums text-apex-dim md:inline">
                      {r.duration ?? ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {active && (
          <PlayerModal
            rec={active}
            presenter={presenters.find((p) => p.id === active.presenter_id) ?? null}
            onClose={() => setActive(null)}
          />
        )}
      </div>
    </PortalShell>
  );
}
