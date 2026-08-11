import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { getMe } from "@/lib/portal.functions";
import { getAcademyHome } from "@/lib/academy.functions";
import { PageHeader, PageBody, Panel, Badge, Button, SearchField, EmptyState } from "@/components/portal/ui";
import { Video, Headphones, FileText, Link2, GraduationCap, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/academy/")({
  head: () => ({ meta: [{ title: "Academy — Vantage Portal" }, { name: "robots", content: "noindex" }] }),
  component: AcademyHome,
});

type ResType = "video" | "audio" | "file" | "link";
const TYPE_ICON: Record<ResType, typeof Video> = { video: Video, audio: Headphones, file: FileText, link: Link2 };
function typeIcon(type: string, size: number) {
  const Icon = TYPE_ICON[(type as ResType) in TYPE_ICON ? (type as ResType) : "link"];
  return <Icon size={size} />;
}

function AcademyHome() {
  const homeFn = useServerFn(getAcademyHome);
  const meFn = useServerFn(getMe);
  const q = useQuery({ queryKey: ["academy", "home"], queryFn: () => homeFn() });
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const canManage =
    (meQ.data?.roles ?? []).some((r) => r === "admin" || r === "super_admin") ||
    !!(meQ.data?.profile as any)?.can_manage_resources;

  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const courses = (q.data?.courses ?? []) as any[];
  const resources = (q.data?.resources ?? []) as any[];
  const allTags = (q.data?.tags ?? []) as string[];

  const filtered = resources.filter((r) => {
    const matchesQ = !search.trim() || r.title.toLowerCase().includes(search.trim().toLowerCase());
    const matchesTags = activeTags.every((t) => (r.tags ?? []).includes(t)); // AND
    return matchesQ && matchesTags;
  });

  const recent = useMemo(() => {
    const c = courses.map((x) => ({ created: x.created_at, node: <RecentCard key={`c-${x.id}`} to={`/portal/academy/courses/${x.slug}`} icon={<GraduationCap size={14} />} title={x.title} sub="Course" required={x.is_required} /> }));
    const r = resources.map((x) => ({ created: x.created_at, node: <RecentCard key={`r-${x.id}`} to={`/portal/academy/library/${x.slug}`} icon={typeIcon(x.type, 14)} title={x.title} sub={cap(x.type)} required={x.is_required} /> }));
    return [...c, ...r].sort((a, b) => (a.created < b.created ? 1 : -1)).slice(0, 6);
  }, [courses, resources]);

  function toggleTag(t: string) {
    setActiveTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  return (
    <PortalShell>
      <PageBody>
        <PageHeader
          title="Vantage Academy"
          description="Courses, recorded trainings, scripts, and tools — built for Vantage agents."
          actions={canManage && <Link to="/portal/academy/admin"><Button variant="secondary" size="sm">Manage Academy</Button></Link>}
        />

        {q.isLoading ? (
          <div className="p-secondary">Loading…</div>
        ) : (
          <>
            {recent.length > 0 && (
              <div className="mb-6">
                <SectionLabel icon={<Clock size={14} />}>Recently added</SectionLabel>
                <div className="flex gap-3 overflow-x-auto pb-1">{recent.map((r) => r.node)}</div>
              </div>
            )}

            <div className="mb-8">
              <SectionLabel icon={<GraduationCap size={15} />}>Courses</SectionLabel>
              {courses.length === 0 ? (
                <Panel><EmptyState title="No courses yet" description="Courses will appear here once published." /></Panel>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {courses.map((c) => (
                    <Link key={c.id} to="/portal/academy/courses/$slug" params={{ slug: c.slug }} className="p-panel flex flex-col gap-2 p-4 transition hover:[border-color:var(--p-border-strong)]">
                      <div className="flex items-start justify-between gap-2">
                        <span className="p-card-title">{c.title}</span>
                        {c.is_required && <Badge tone="gold">Required</Badge>}
                      </div>
                      {c.instructor_name && <span className="p-muted">{c.instructor_name}</span>}
                      {c.description && <p className="p-secondary leading-snug">{c.description}</p>}
                      <div className="mt-auto pt-2">
                        {c.progress === null ? (
                          <span className="p-muted">Not started</span>
                        ) : c.completed ? (
                          <Badge tone="green">Completed</Badge>
                        ) : (
                          <>
                            <div className="mb-1"><span className="p-muted">{c.progress}% complete</span></div>
                            <ProgressBar pct={c.progress} />
                          </>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <SectionLabel icon={<FileText size={15} />}>Library</SectionLabel>
              <div className="mb-3 flex flex-col gap-3">
                <SearchField value={search} onChange={setSearch} placeholder="Search the library…" />
                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.map((t) => {
                      const active = activeTags.includes(t);
                      return (
                        <button key={t} onClick={() => toggleTag(t)} className="p-focus rounded-full border px-3 py-1 text-[12.5px] font-medium transition"
                          style={active ? { background: "var(--p-gold-soft)", color: "var(--p-gold)", borderColor: "transparent" } : { color: "var(--p-text-2)", borderColor: "var(--p-border)" }}>
                          {t}
                        </button>
                      );
                    })}
                    {activeTags.length > 0 && (
                      <button onClick={() => setActiveTags([])} className="p-focus px-2 text-[12.5px]" style={{ color: "var(--p-text-3)" }}>Clear</button>
                    )}
                  </div>
                )}
              </div>

              {filtered.length === 0 ? (
                <Panel><p className="p-secondary">No resources match those filters.</p></Panel>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((r) => (
                    <Link key={r.id} to="/portal/academy/library/$slug" params={{ slug: r.slug }} className="p-panel flex flex-col gap-2 p-4 transition hover:[border-color:var(--p-border-strong)]">
                      <div className="flex items-start justify-between gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-[8px]" style={{ background: "var(--p-raised)", color: "var(--p-gold)" }}>{typeIcon(r.type, 15)}</span>
                        {r.is_required && <Badge tone="gold">Required</Badge>}
                      </div>
                      <span className="p-card-title">{r.title}</span>
                      {r.description && <p className="p-secondary leading-snug">{r.description}</p>}
                      <div className="mt-auto flex flex-wrap gap-1 pt-1">
                        {(r.tags ?? []).map((t: string) => <Badge key={t} tone="neutral">{t}</Badge>)}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </PageBody>
    </PortalShell>
  );
}

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span style={{ color: "var(--p-gold)" }}>{icon}</span>
      <h2 className="p-section-title">{children}</h2>
    </div>
  );
}
function RecentCard({ to, icon, title, sub, required }: { to: string; icon: React.ReactNode; title: string; sub: string; required: boolean }) {
  return (
    <Link to={to} className="p-panel flex min-w-[210px] max-w-[210px] flex-col gap-1.5 p-3 transition hover:[border-color:var(--p-border-strong)]">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--p-text-3)" }}>
          <span style={{ color: "var(--p-gold)" }}>{icon}</span>{sub}
        </span>
        {required && <Badge tone="gold">Req</Badge>}
      </div>
      <span className="p-card-title truncate">{title}</span>
    </Link>
  );
}
function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--p-hover)" }}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(3, pct)}%`, background: "var(--p-gold)" }} />
    </div>
  );
}
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
