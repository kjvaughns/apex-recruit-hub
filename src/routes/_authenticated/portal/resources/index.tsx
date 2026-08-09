import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/apex/portal-shell";
import { getResourceHub, listPresentersWithRecordings } from "@/lib/resources.functions";
import { getMe } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/portal/resources/")({
  head: () => ({ meta: [{ title: "Agent Hub — Vantage Portal" }, { name: "robots", content: "noindex" }] }),
  component: HubPage,
});

const HUB = [
  {
    to: "/portal/resources/presentations" as const,
    num: "01",
    label: "Recorded Trainings",
    desc: "Watch and listen to recorded calls and trainings from the team — with a built-in transcript for every session.",
  },
  {
    to: "/portal/resources/library" as const,
    num: "02",
    label: "Resource Library",
    desc: "Scripts, carrier guides, trainings, and PDFs — searchable and filterable by type.",
  },
];

function HubPage() {
  const hubFn = useServerFn(getResourceHub);
  const meFn = useServerFn(getMe);
  const hubQ = useQuery({ queryKey: ["resource-hub"], queryFn: () => hubFn() });
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const isAdmin = (meQ.data?.roles ?? []).some((r) => r === "admin" || r === "super_admin");

  const meta: Record<string, string> = {
    "/portal/resources/presentations": `${hubQ.data?.presenterCount ?? 0} presenters · ${hubQ.data?.recordingCount ?? 0} recordings`,
    "/portal/resources/library": `${hubQ.data?.resourceCount ?? 0} resources`,
  };
  const quickLinks = hubQ.data?.quickLinks ?? [];

  return (
    <PortalShell>
      <div className="mx-auto max-w-[1240px] px-6 pb-20 md:px-8">
        {/* Hero */}
        <section className="max-w-[760px] pt-14 pb-10 md:pt-16">
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.22em] text-apex-gold">Agent Hub</p>
          <h1 className="font-display text-[clamp(44px,6vw,78px)] leading-[0.96] tracking-[0.01em]">
            Everything you need, in one place.
          </h1>
          <p className="mt-5 max-w-[560px] text-[17px] leading-[1.55] text-apex-dim">
            Recordings, trainings, scripts, and tools — curated for Vantage agents and updated weekly.
          </p>
          {isAdmin && (
            <Link
              to="/portal/resources/admin"
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-apex-gold/40 bg-apex-gold/10 px-4 py-2 text-[13px] font-semibold text-apex-gold hover:bg-apex-gold/15"
            >
              ⚙ Manage hub content
            </Link>
          )}
        </section>

        {/* Hub tiles */}
        <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
          {HUB.map((h) => (
            <Link
              key={h.to}
              to={h.to}
              className="group relative flex min-h-[230px] flex-col gap-4 overflow-hidden rounded-[16px] border border-white/[0.09] bg-[#131313] p-[30px] transition hover:-translate-y-1 hover:border-apex-gold"
            >
              <span
                className="font-display text-[44px] leading-none tracking-wider"
                style={{
                  color: "transparent",
                  WebkitTextStroke: "1.5px color-mix(in srgb, #C9A84C 55%, transparent)",
                }}
              >
                {h.num}
              </span>
              <div className="flex flex-1 flex-col gap-2.5">
                <div className="font-display text-[34px] leading-none tracking-[0.012em] uppercase">{h.label}</div>
                <p className="max-w-[42ch] text-[15px] leading-[1.55] text-apex-dim">{h.desc}</p>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-[18px]">
                <span className="text-[13px] text-apex-faint">{meta[h.to]}</span>
                <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-apex-gold">
                  Open <span className="transition-transform group-hover:translate-x-1">→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Links */}
        <section className="mt-[72px]">
          <div className="mb-[22px] flex items-center gap-[18px]">
            <span className="h-px flex-1 bg-white/[0.09]" />
            <span className="font-display text-[22px] uppercase tracking-[0.06em] text-apex-dim">Quick Links</span>
            <span className="h-px flex-1 bg-white/[0.09]" />
          </div>
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            {quickLinks.map((l) => (
              <a
                key={l.id}
                href={l.url}
                target={l.url?.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                className="flex flex-col gap-1.5 rounded-xl border border-white/[0.09] bg-[#131313] px-[22px] py-5 transition hover:-translate-y-0.5 hover:border-apex-gold"
              >
                <div className="flex items-center justify-between text-[16px] font-semibold">
                  <span>{l.label}</span>
                  <span className="text-apex-gold">↗</span>
                </div>
                {l.sub && <span className="text-[13px] text-apex-faint">{l.sub}</span>}
              </a>
            ))}
          </div>
        </section>

        <footer className="mt-16 flex flex-wrap items-center gap-2.5 border-t border-white/[0.09] pt-6 text-[13px] text-apex-faint">
          <span>Vantage Financial</span>
          <span className="text-white/10">·</span>
          <span>Internal agent resources</span>
          <span className="text-white/10">·</span>
          <span>Confidential — do not distribute</span>
        </footer>
      </div>
    </PortalShell>
  );
}
