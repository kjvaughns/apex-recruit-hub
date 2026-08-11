import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PortalShell } from "@/components/vantage/portal-shell";
import { PageBody, Panel, Button, Badge } from "@/components/portal/ui";
import {
  ChevronLeft,
  CheckCircle2,
  Circle,
  Lock,
  HelpCircle,
  PlayCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/academy/courses/$slug")({
  head: () => ({ meta: [{ title: "Course — Vantage Academy" }, { name: "robots", content: "noindex" }] }),
  component: CoursePlayer,
});

/* ---- Phase 0 mock structure (Phase 3 wires real enrollment/progress) ---- */
type Lesson = {
  id: string;
  title: string;
  kind: "lesson" | "quiz";
  status: "done" | "current" | "todo" | "locked";
};
type Module = { id: string; title: string; lessons: Lesson[] };

const MOCK_MODULES: Module[] = [
  {
    id: "m1",
    title: "Getting set up",
    lessons: [
      { id: "l1", title: "Welcome to Vantage", kind: "lesson", status: "done" },
      { id: "l2", title: "AgentSpace contracting", kind: "lesson", status: "current" },
      { id: "q1", title: "Setup check", kind: "quiz", status: "todo" },
    ],
  },
  {
    id: "m2",
    title: "Going active",
    lessons: [
      { id: "l3", title: "Discord role update", kind: "lesson", status: "locked" },
      { id: "l4", title: "Expectations review", kind: "lesson", status: "locked" },
    ],
  },
];

function CoursePlayer() {
  const { slug } = Route.useParams();
  const [openModules, setOpenModules] = useState<string[]>(MOCK_MODULES.map((m) => m.id));
  const [selected, setSelected] = useState<string>("l2");

  const all = MOCK_MODULES.flatMap((m) => m.lessons);
  const done = all.filter((l) => l.status === "done").length;
  const current = all.find((l) => l.id === selected) ?? all[0];

  function toggleModule(id: string) {
    setOpenModules((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  return (
    <PortalShell>
      <PageBody>
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link to="/portal/academy" className="p-focus inline-flex items-center gap-1 text-[13px]" style={{ color: "var(--p-text-2)" }}>
            <ChevronLeft size={15} /> Academy
          </Link>
          <span className="p-muted">{done} of {all.length} complete</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
          {/* Outline */}
          <Panel padded={false} className="overflow-hidden">
            <div className="border-b px-4 py-3" style={{ borderColor: "var(--p-border)" }}>
              <div className="p-section-title truncate">Vantage Onboarding</div>
              <div className="p-muted mt-0.5 capitalize">{slug.replace(/-/g, " ")}</div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-2">
              {MOCK_MODULES.map((m) => {
                const open = openModules.includes(m.id);
                return (
                  <div key={m.id} className="mb-1">
                    <button onClick={() => toggleModule(m.id)} className="p-focus flex w-full items-center justify-between rounded-[8px] px-2 py-2 text-left">
                      <span className="text-[12.5px] font-semibold uppercase tracking-[0.05em]" style={{ color: "var(--p-text-3)" }}>{m.title}</span>
                      <span style={{ color: "var(--p-text-3)" }}>{open ? "−" : "+"}</span>
                    </button>
                    {open &&
                      m.lessons.map((l) => (
                        <button
                          key={l.id}
                          disabled={l.status === "locked"}
                          onClick={() => setSelected(l.id)}
                          className="p-focus flex w-full items-center gap-2 rounded-[8px] px-2 py-2 text-left text-[13.5px] transition disabled:cursor-not-allowed"
                          style={{
                            background: selected === l.id ? "var(--p-gold-soft)" : "transparent",
                            color: l.status === "locked" ? "var(--p-text-3)" : selected === l.id ? "var(--p-gold)" : "var(--p-text)",
                            opacity: l.status === "locked" ? 0.55 : 1,
                          }}
                        >
                          <LessonIcon lesson={l} />
                          <span className="min-w-0 flex-1 truncate">{l.title}</span>
                          {l.kind === "quiz" && <Badge tone="amber">Quiz</Badge>}
                        </button>
                      ))}
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Main */}
          <div className="min-w-0 space-y-4">
            {current?.kind === "quiz" ? (
              <Panel title={current.title} description="Pass at 75% to unlock the next lessons.">
                <p className="p-secondary">Quiz questions render here (Phase 3). Multiple choice, submit &amp; score.</p>
              </Panel>
            ) : (
              <>
                <div className="p-panel grid aspect-video w-full place-items-center overflow-hidden" style={{ background: "var(--p-raised)" }}>
                  <PlayCircle size={48} style={{ color: "var(--p-text-3)" }} />
                </div>
                <Panel title={current?.title ?? "Lesson"}>
                  <p className="p-secondary leading-relaxed">
                    Lesson blurb / notes render here. This is the premium learning area — video above,
                    context below, and a clear path forward.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="primary" size="sm">Mark complete</Button>
                    <Button variant="secondary" size="sm">Next lesson →</Button>
                  </div>
                </Panel>
              </>
            )}
          </div>
        </div>
      </PageBody>
    </PortalShell>
  );
}

function LessonIcon({ lesson }: { lesson: Lesson }) {
  if (lesson.status === "locked") return <Lock size={15} />;
  if (lesson.status === "done") return <CheckCircle2 size={15} style={{ color: "var(--p-green)" }} />;
  if (lesson.kind === "quiz") return <HelpCircle size={15} style={{ color: "var(--p-amber)" }} />;
  return <Circle size={15} />;
}
