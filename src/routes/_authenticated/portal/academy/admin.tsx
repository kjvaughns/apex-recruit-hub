import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { getMe } from "@/lib/portal.functions";
import {
  PageHeader,
  PageBody,
  Panel,
  Button,
  Badge,
  SegmentedControl,
  Table,
  TableWrap,
  THead,
  TH,
  TR,
  TD,
  EmptyState,
} from "@/components/portal/ui";
import { GripVertical, Plus, Video, HelpCircle, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/academy/admin")({
  head: () => ({ meta: [{ title: "Academy Admin — Vantage Portal" }, { name: "robots", content: "noindex" }] }),
  component: AcademyAdmin,
});

function AcademyAdmin() {
  const meFn = useServerFn(getMe);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const roles = meQ.data?.roles ?? [];
  const profile = meQ.data?.profile as any;
  const canManage =
    roles.some((r) => r === "admin" || r === "super_admin" || r === "manager") ||
    (roles.includes("leader") && !!profile?.can_manage_resources);

  const [tab, setTab] = useState<"courses" | "library">("courses");

  if (meQ.isLoading) {
    return (
      <PortalShell>
        <PageBody>
          <div className="p-secondary">Loading…</div>
        </PageBody>
      </PortalShell>
    );
  }

  if (!canManage) {
    return (
      <PortalShell>
        <PageBody>
          <EmptyState title="Not permitted" description="Only admins and leaders with course-edit access can manage Academy content." />
        </PageBody>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <PageBody>
        <Link to="/portal/academy" className="p-focus mb-3 inline-flex items-center gap-1 text-[13px]" style={{ color: "var(--p-text-2)" }}>
          <ChevronLeft size={15} /> Academy
        </Link>
        <PageHeader
          title="Academy builder"
          description="Create and organize courses and library resources."
          actions={
            <SegmentedControl
              value={tab}
              onChange={setTab}
              options={[
                { value: "courses", label: "Courses" },
                { value: "library", label: "Library" },
              ]}
            />
          }
        />

        {tab === "courses" ? <CoursesBuilder /> : <LibraryBuilder />}
      </PageBody>
    </PortalShell>
  );
}

/* ---- Phase 0 static shells (Phase 2 wires CRUD + DnD) ---- */

function CoursesBuilder() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr] lg:items-start">
      <Panel
        title="Courses"
        actions={<Button variant="primary" size="sm"><Plus size={14} /> New course</Button>}
        padded={false}
      >
        <TableWrap className="border-0">
          <Table>
            <THead>
              <TH>Title</TH>
              <TH>Status</TH>
            </THead>
            <tbody>
              <TR>
                <TD className="p-card-title">Vantage Onboarding <Badge tone="gold" className="ml-1.5">Required</Badge></TD>
                <TD><Badge tone="green">Published</Badge></TD>
              </TR>
              <TR>
                <TD className="p-card-title">Objection Mastery</TD>
                <TD><Badge tone="neutral">Draft</Badge></TD>
              </TR>
            </tbody>
          </Table>
        </TableWrap>
      </Panel>

      <Panel
        title="Vantage Onboarding"
        description="Modules, lessons, and quizzes — drag to reorder (Phase 2)."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm">Preview as learner</Button>
            <Button variant="primary" size="sm">Publish</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <ModuleBlock name="Getting set up" lessons={[["Welcome to Vantage", "lesson"], ["AgentSpace contracting", "lesson"], ["Setup check", "quiz"]]} />
          <ModuleBlock name="Going active" lessons={[["Discord role update", "lesson"], ["Expectations review", "lesson"]]} />
          <Button variant="ghost" size="sm"><Plus size={14} /> Add module</Button>
        </div>
      </Panel>
    </div>
  );
}

function ModuleBlock({ name, lessons }: { name: string; lessons: [string, "lesson" | "quiz"][] }) {
  return (
    <div className="p-panel p-3">
      <div className="mb-2 flex items-center gap-2">
        <GripVertical size={15} style={{ color: "var(--p-text-3)" }} />
        <span className="p-card-title flex-1">{name}</span>
        <Button variant="ghost" size="sm"><Plus size={13} /> Lesson</Button>
      </div>
      <div className="space-y-1.5 pl-6">
        {lessons.map(([t, kind]) => (
          <div key={t} className="flex items-center gap-2 rounded-[8px] px-2 py-1.5" style={{ background: "var(--p-hover)" }}>
            <GripVertical size={14} style={{ color: "var(--p-text-3)" }} />
            {kind === "quiz" ? <HelpCircle size={14} style={{ color: "var(--p-amber)" }} /> : <Video size={14} style={{ color: "var(--p-text-2)" }} />}
            <span className="flex-1 text-[13px]">{t}</span>
            {kind === "quiz" && <Badge tone="amber">Quiz</Badge>}
          </div>
        ))}
      </div>
    </div>
  );
}

function LibraryBuilder() {
  return (
    <Panel
      title="Library resources"
      actions={<Button variant="primary" size="sm"><Plus size={14} /> New resource</Button>}
      padded={false}
    >
      <TableWrap className="border-0">
        <Table>
          <THead>
            <TH>Title</TH>
            <TH>Type</TH>
            <TH>Tags</TH>
            <TH>Required</TH>
          </THead>
          <tbody>
            <TR>
              <TD className="p-card-title">Needs Analysis Script</TD>
              <TD><Badge tone="blue">File</Badge></TD>
              <TD className="p-muted">Scripts, Appointments</TD>
              <TD><Badge tone="gold">Required</Badge></TD>
            </TR>
            <TR>
              <TD className="p-card-title">Objections Role-Play</TD>
              <TD><Badge tone="blue">Video</Badge></TD>
              <TD className="p-muted">Objections, Video</TD>
              <TD className="p-muted">—</TD>
            </TR>
          </tbody>
        </Table>
      </TableWrap>
    </Panel>
  );
}
