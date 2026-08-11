import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PortalShell } from "@/components/vantage/portal-shell";
import {
  PageHeader,
  PageBody,
  Panel,
  Badge,
  Button,
  SearchField,
} from "@/components/portal/ui";
import { Video, Headphones, FileText, Link2, GraduationCap, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/academy/")({
  head: () => ({ meta: [{ title: "Academy — Vantage Portal" }, { name: "robots", content: "noindex" }] }),
  component: AcademyHome,
});

/* ---- Phase 0 mock data (Phases 1/3/4 wire real queries) ---- */
type MockCourse = {
  slug: string;
  title: string;
  instructor: string;
  description: string;
  progress: number | null;
  required: boolean;
  created: string;
};
type ResType = "video" | "audio" | "file" | "link";
type MockResource = {
  slug: string;
  title: string;
  description: string;
  type: ResType;
  tags: string[];
  required: boolean;
  created: string;
};

const MOCK_COURSES: MockCourse[] = [
  {
    slug: "vantage-onboarding",
    title: "Vantage Onboarding",
    instructor: "Vantage Team",
    description: "Everything you need to get set up and active as a licensed Vantage agent.",
    progress: 50,
    required: true,
    created: "2026-08-10",
  },
  {
    slug: "objection-mastery",
    title: "Objection Mastery",
    instructor: "KJ Vaughns",
    description: "Handle every common objection with confidence and a repeatable framework.",
    progress: null,
    required: false,
    created: "2026-08-06",
  },
];

const MOCK_RESOURCES: MockResource[] = [
  { slug: "needs-analysis-script", title: "Needs Analysis Script", description: "The full discovery script for first appointments.", type: "file", tags: ["Scripts", "Appointments"], required: true, created: "2026-08-09" },
  { slug: "objections-role-play", title: "Objections Role-Play", description: "Recorded role-play covering the top 5 objections.", type: "video", tags: ["Objections", "Video"], required: false, created: "2026-08-08" },
  { slug: "carrier-guide-mutual", title: "Carrier Guide — Mutual", description: "Underwriting and product guide.", type: "link", tags: ["Carriers"], required: false, created: "2026-08-05" },
  { slug: "morning-mindset", title: "Morning Mindset Audio", description: "Ten minutes to lock in before you dial.", type: "audio", tags: ["Mindset", "Audio"], required: false, created: "2026-08-04" },
];

const TYPE_ICON: Record<ResType, typeof Video> = { video: Video, audio: Headphones, file: FileText, link: Link2 };

function AcademyHome() {
  const [q, setQ] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const allTags = useMemo(
    () => Array.from(new Set(MOCK_RESOURCES.flatMap((r) => r.tags))).sort(),
    [],
  );

  const filtered = MOCK_RESOURCES.filter((r) => {
    const matchesQ = !q.trim() || r.title.toLowerCase().includes(q.trim().toLowerCase());
    const matchesTags = activeTags.every((t) => r.tags.includes(t)); // AND logic
    return matchesQ && matchesTags;
  });

  const recent = [
    ...MOCK_COURSES.map((c) => ({ kind: "course" as const, created: c.created, node: <RecentCard key={`c-${c.slug}`} to={`/portal/academy/courses/${c.slug}`} icon={<GraduationCap size={14} />} title={c.title} sub="Course" required={c.required} /> })),
    ...MOCK_RESOURCES.map((r) => ({ kind: "resource" as const, created: r.created, node: <RecentCard key={`r-${r.slug}`} to={`/portal/academy/library/${r.slug}`} icon={typeIcon(r.type, 14)} title={r.title} sub={cap(r.type)} required={r.required} /> })),
  ]
    .sort((a, b) => (a.created < b.created ? 1 : -1))
    .slice(0, 6);

  function toggleTag(t: string) {
    setActiveTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  return (
    <PortalShell>
      <PageBody>
        <PageHeader
          title="Vantage Academy"
          description="Courses, recorded trainings, scripts, and tools — built for Vantage agents."
          actions={
            <Link to="/portal/academy/admin">
              <Button variant="secondary" size="sm">Manage Academy</Button>
            </Link>
          }
        />

        {/* Recently Added */}
        <div className="mb-6">
          <SectionLabel icon={<Clock size={14} />}>Recently added</SectionLabel>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {recent.map((r) => r.node)}
          </div>
        </div>

        {/* Courses */}
        <div className="mb-8">
          <SectionLabel icon={<GraduationCap size={15} />}>Courses</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MOCK_COURSES.map((c) => (
              <Link key={c.slug} to="/portal/academy/courses/$slug" params={{ slug: c.slug }} className="p-panel flex flex-col gap-2 p-4 transition hover:[border-color:var(--p-border-strong)]">
                <div className="flex items-start justify-between gap-2">
                  <span className="p-card-title">{c.title}</span>
                  {c.required && <Badge tone="gold">Required</Badge>}
                </div>
                <span className="p-muted">{c.instructor}</span>
                <p className="p-secondary leading-snug">{c.description}</p>
                <div className="mt-auto pt-2">
                  {c.progress === null ? (
                    <span className="p-muted">Not started</span>
                  ) : (
                    <>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="p-muted">{c.progress}% complete</span>
                      </div>
                      <ProgressBar pct={c.progress} />
                    </>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Library */}
        <div>
          <SectionLabel icon={<FileText size={15} />}>Library</SectionLabel>
          <div className="mb-3 flex flex-col gap-3">
            <SearchField value={q} onChange={setQ} placeholder="Search the library…" />
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((t) => {
                const active = activeTags.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className="p-focus rounded-full border px-3 py-1 text-[12.5px] font-medium transition"
                    style={
                      active
                        ? { background: "var(--p-gold-soft)", color: "var(--p-gold)", borderColor: "transparent" }
                        : { color: "var(--p-text-2)", borderColor: "var(--p-border)" }
                    }
                  >
                    {t}
                  </button>
                );
              })}
              {activeTags.length > 0 && (
                <button onClick={() => setActiveTags([])} className="p-focus px-2 text-[12.5px]" style={{ color: "var(--p-text-3)" }}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <Panel><p className="p-secondary">No resources match those filters.</p></Panel>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((r) => (
                <Link key={r.slug} to="/portal/academy/library/$slug" params={{ slug: r.slug }} className="p-panel flex flex-col gap-2 p-4 transition hover:[border-color:var(--p-border-strong)]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-[8px]" style={{ background: "var(--p-raised)", color: "var(--p-gold)" }}>
                      {typeIcon(r.type, 15)}
                    </span>
                    {r.required && <Badge tone="gold">Required</Badge>}
                  </div>
                  <span className="p-card-title">{r.title}</span>
                  <p className="p-secondary leading-snug">{r.description}</p>
                  <div className="mt-auto flex flex-wrap gap-1 pt-1">
                    {r.tags.map((t) => (
                      <Badge key={t} tone="neutral">{t}</Badge>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
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
          <span style={{ color: "var(--p-gold)" }}>{icon}</span>
          {sub}
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

function typeIcon(type: ResType, size: number) {
  const Icon = TYPE_ICON[type];
  return <Icon size={size} />;
}
function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
