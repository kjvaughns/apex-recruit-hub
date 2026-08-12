import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PortalShell } from "@/components/vantage/portal-shell";
import { getMe } from "@/lib/portal.functions";
import {
  adminListCourses,
  adminGetCourse,
  adminUpsertCourse,
  adminDeleteCourse,
  adminUpsertModule,
  adminUpsertLesson,
  adminUpsertQuestion,
  adminDeleteNode,
  adminReorder,
  adminListLibrary,
  adminUpsertResource,
  adminDeleteResource,
  adminRenameTag,
  adminDeleteTag,
} from "@/lib/academy.functions";
import { supabase } from "@/integrations/supabase/client";
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
  ErrorState,
  Modal,
  Field,
  Input,
  Textarea,
  Select,
  FormGrid,
  Checkbox,
  Radio,
  TableSkeleton,
  CardSkeleton,
  notify,
} from "@/components/portal/ui";
import { GripVertical, Plus, HelpCircle, Video, Trash2, ChevronLeft, Pencil } from "lucide-react";

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
    roles.some((r) => r === "admin" || r === "super_admin") || !!profile?.can_manage_resources;
  const [tab, setTab] = useState<"courses" | "library">("courses");

  if (meQ.isLoading)
    return (
      <PortalShell>
        <PageBody>
          <CardSkeleton lines={4} />
        </PageBody>
      </PortalShell>
    );
  if (!canManage)
    return (
      <PortalShell>
        <PageBody>
          <EmptyState title="Not permitted" description="Only admins and leaders with course-edit access can manage Academy content." />
        </PageBody>
      </PortalShell>
    );

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
              options={[{ value: "courses", label: "Courses" }, { value: "library", label: "Library" }]}
            />
          }
        />
        {tab === "courses" ? <CoursesBuilder /> : <LibraryBuilder />}
      </PageBody>
    </PortalShell>
  );
}

/* -------------------------------------------------------------------------- */
/* DnD helpers                                                                */
/* -------------------------------------------------------------------------- */

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="flex items-center gap-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="p-focus cursor-grab touch-none"
        style={{ color: "var(--p-text-3)" }}
        aria-label="Drag to reorder"
      >
        <GripVertical size={15} />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function SortableList({ ids, onReorder, children }: { ids: string[]; onReorder: (ids: string[]) => void; children: ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldI = ids.indexOf(active.id as string);
      const newI = ids.indexOf(over.id as string);
      if (oldI >= 0 && newI >= 0) onReorder(arrayMove(ids, oldI, newI));
    }
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/* -------------------------------------------------------------------------- */
/* Courses                                                                    */
/* -------------------------------------------------------------------------- */

function CoursesBuilder() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListCourses);
  const delFn = useServerFn(adminDeleteCourse);
  const coursesQ = useQuery({ queryKey: ["academy", "courses"], queryFn: () => listFn() });
  const [selected, setSelected] = useState<string | null>(null);
  const [metaOpen, setMetaOpen] = useState<null | { id?: string }>(null);

  const courses = coursesQ.data?.courses ?? [];

  async function del(id: string) {
    if (!confirm("Delete this course and all its content?")) return;
    try {
      await delFn({ data: { id } });
      if (selected === id) setSelected(null);
      qc.invalidateQueries({ queryKey: ["academy", "courses"] });
      notify.success("Course deleted.");
    } catch {
      notify.error("Couldn't delete this course. Please try again.");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr] lg:items-start">
      <Panel
        title="Courses"
        actions={<Button variant="primary" size="sm" onClick={() => setMetaOpen({})}><Plus size={14} /> New</Button>}
        padded={false}
      >
        {coursesQ.isError ? (
          <ErrorState description="Couldn't load courses. Please try again." onRetry={() => coursesQ.refetch()} />
        ) : coursesQ.isLoading ? (
          <TableSkeleton rows={4} cols={3} />
        ) : courses.length === 0 ? (
          <EmptyState title="No courses yet" description="Create your first course to get started." />
        ) : (
          <TableWrap className="border-0">
            <Table>
              <THead><TH>Title</TH><TH>Status</TH><TH align="right" /></THead>
              <tbody>
                {courses.map((c: any) => (
                  <TR key={c.id} onClick={() => setSelected(c.id)} className={selected === c.id ? "bg-[var(--p-hover)]" : ""}>
                    <TD className="p-card-title">
                      {c.title} {c.is_required && <Badge tone="gold" className="ml-1">Required</Badge>}
                    </TD>
                    <TD><Badge tone={c.status === "published" ? "green" : "neutral"}>{c.status}</Badge></TD>
                    <TD align="right">
                      <button onClick={(e) => { e.stopPropagation(); del(c.id); }} className="p-focus" style={{ color: "var(--p-text-3)" }} aria-label="Delete">
                        <Trash2 size={15} />
                      </button>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>

      {selected ? (
        <CourseEditor courseId={selected} onEditMeta={(id) => setMetaOpen({ id })} />
      ) : (
        <Panel><EmptyState title="Select a course" description="Pick a course on the left to edit its modules and lessons." /></Panel>
      )}

      {metaOpen && (
        <CourseMetaModal
          courseId={metaOpen.id}
          onClose={() => setMetaOpen(null)}
          onSaved={(id) => {
            setMetaOpen(null);
            setSelected(id);
            qc.invalidateQueries({ queryKey: ["academy", "courses"] });
            qc.invalidateQueries({ queryKey: ["academy", "course", id] });
          }}
        />
      )}
    </div>
  );
}

function CourseMetaModal({ courseId, onClose, onSaved }: { courseId?: string; onClose: () => void; onSaved: (id: string) => void }) {
  const getFn = useServerFn(adminGetCourse);
  const saveFn = useServerFn(adminUpsertCourse);
  const existing = useQuery({
    queryKey: ["academy", "course-meta", courseId],
    queryFn: () => getFn({ data: { id: courseId! } }),
    enabled: !!courseId,
  });
  const c = existing.data?.course as any;
  const [f, setF] = useState({ title: "", description: "", instructor_name: "", instructor_role: "", is_required: false, status: "draft" as "draft" | "published" });
  const [loaded, setLoaded] = useState(false);
  if (c && !loaded) {
    setF({
      title: c.title ?? "",
      description: c.description ?? "",
      instructor_name: c.instructor_name ?? "",
      instructor_role: c.instructor_role ?? "",
      is_required: !!c.is_required,
      status: c.status ?? "draft",
    });
    setLoaded(true);
  }
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!f.title.trim()) return;
    setBusy(true);
    try {
      const res = await saveFn({ data: { id: courseId, ...f } });
      notify.success("Course saved.");
      onSaved(res.id);
    } catch (e) {
      notify.error("Couldn't save. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={courseId ? "Edit course" : "New course"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!f.title.trim()} loading={busy}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title" required><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <FormGrid>
          <Field label="Instructor name"><Input value={f.instructor_name} onChange={(e) => setF({ ...f, instructor_name: e.target.value })} /></Field>
          <Field label="Instructor role"><Input value={f.instructor_role} onChange={(e) => setF({ ...f, instructor_role: e.target.value })} /></Field>
        </FormGrid>
        <FormGrid>
          <Field label="Status">
            <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as any })}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </Select>
          </Field>
          <Field label="Required">
            <Checkbox
              checked={f.is_required}
              onChange={(v) => setF({ ...f, is_required: v })}
              label="Mark this course required"
              className="mt-2"
            />
          </Field>
        </FormGrid>
      </div>
    </Modal>
  );
}

function CourseEditor({ courseId, onEditMeta }: { courseId: string; onEditMeta: (id: string) => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(adminGetCourse);
  const upModule = useServerFn(adminUpsertModule);
  const reorderFn = useServerFn(adminReorder);
  const delNode = useServerFn(adminDeleteNode);
  const q = useQuery({ queryKey: ["academy", "course", courseId], queryFn: () => getFn({ data: { id: courseId } }) });
  const [lessonEdit, setLessonEdit] = useState<null | { moduleId: string; lessonId?: string }>(null);

  const course = q.data?.course as any;
  const modules = (q.data?.modules ?? []) as any[];
  const lessons = (q.data?.lessons ?? []) as any[];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["academy", "course", courseId] });

  async function addModule() {
    const title = prompt("Module title");
    if (!title?.trim()) return;
    await upModule({ data: { course_id: courseId, title: title.trim() } });
    invalidate();
  }
  async function reorderModules(ids: string[]) {
    await reorderFn({ data: { kind: "module", ids } });
    invalidate();
  }
  async function reorderLessons(ids: string[]) {
    await reorderFn({ data: { kind: "lesson", ids } });
    invalidate();
  }
  async function removeModule(id: string) {
    if (!confirm("Delete this module and its lessons?")) return;
    await delNode({ data: { kind: "module", id } });
    invalidate();
  }
  async function removeLesson(id: string) {
    if (!confirm("Delete this lesson?")) return;
    await delNode({ data: { kind: "lesson", id } });
    invalidate();
  }

  if (q.isError) return <Panel><ErrorState description="Couldn't load this course. Please try again." onRetry={() => q.refetch()} /></Panel>;
  if (q.isLoading) return <Panel><CardSkeleton lines={5} /></Panel>;

  return (
    <Panel
      title={course?.title ?? "Course"}
      description={`/academy/courses/${course?.slug ?? ""}`}
      actions={
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => onEditMeta(courseId)}><Pencil size={13} /> Details</Button>
          <Link to="/portal/academy/courses/$slug" params={{ slug: course?.slug ?? "" }}>
            <Button variant="secondary" size="sm">Preview</Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-3">
        <SortableList ids={modules.map((m) => m.id)} onReorder={reorderModules}>
          {modules.map((m) => {
            const modLessons = lessons.filter((l) => l.module_id === m.id);
            return (
              <div key={m.id} className="p-panel mb-2 p-3">
                <SortableRow id={m.id}>
                  <div className="flex items-center gap-2">
                    <span className="p-card-title flex-1">{m.title}</span>
                    <Button variant="ghost" size="sm" onClick={() => setLessonEdit({ moduleId: m.id })}><Plus size={13} /> Lesson</Button>
                    <button onClick={() => removeModule(m.id)} className="p-focus" style={{ color: "var(--p-text-3)" }} aria-label="Delete module"><Trash2 size={14} /></button>
                  </div>
                </SortableRow>
                <div className="mt-2 pl-6">
                  <SortableList ids={modLessons.map((l) => l.id)} onReorder={reorderLessons}>
                    {modLessons.map((l) => (
                      <div key={l.id} className="mb-1.5 rounded-[8px] px-2 py-1.5" style={{ background: "var(--p-hover)" }}>
                        <SortableRow id={l.id}>
                          <div className="flex items-center gap-2">
                            {l.kind === "quiz" ? <HelpCircle size={14} style={{ color: "var(--p-amber)" }} /> : <Video size={14} style={{ color: "var(--p-text-2)" }} />}
                            <button onClick={() => setLessonEdit({ moduleId: m.id, lessonId: l.id })} className="p-focus flex-1 truncate text-left text-[13px]">{l.title}</button>
                            {l.kind === "quiz" && <Badge tone="amber">Quiz</Badge>}
                            <button onClick={() => removeLesson(l.id)} className="p-focus" style={{ color: "var(--p-text-3)" }} aria-label="Delete lesson"><Trash2 size={13} /></button>
                          </div>
                        </SortableRow>
                      </div>
                    ))}
                  </SortableList>
                  {modLessons.length === 0 && <div className="p-muted py-1">No lessons yet.</div>}
                </div>
              </div>
            );
          })}
        </SortableList>
        <Button variant="ghost" size="sm" onClick={addModule}><Plus size={14} /> Add module</Button>
      </div>

      {lessonEdit && (
        <LessonModal
          moduleId={lessonEdit.moduleId}
          lessonId={lessonEdit.lessonId}
          lesson={lessons.find((l) => l.id === lessonEdit.lessonId)}
          questions={(q.data?.questions ?? []) as any[]}
          onClose={() => setLessonEdit(null)}
          onSaved={() => { setLessonEdit(null); invalidate(); }}
        />
      )}
    </Panel>
  );
}

function LessonModal({ moduleId, lessonId, lesson, questions, onClose, onSaved }: {
  moduleId: string; lessonId?: string; lesson?: any; questions: any[]; onClose: () => void; onSaved: () => void;
}) {
  const saveFn = useServerFn(adminUpsertLesson);
  const [f, setF] = useState({
    title: lesson?.title ?? "",
    kind: (lesson?.kind ?? "lesson") as "lesson" | "quiz",
    media_type: (lesson?.media_type ?? "video") as "video" | "audio",
    video_url: lesson?.video_url ?? "",
    duration: lesson?.duration ?? "",
    blurb: lesson?.blurb ?? "",
    quiz_pass_threshold: lesson?.quiz_pass_threshold ?? 0.75,
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `lessons/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("academy").upload(path, file, { upsert: true });
      if (error) throw error;
      // The academy bucket is private, so store a long-lived signed URL.
      const { data: signed, error: signErr } = await supabase.storage
        .from("academy")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Could not sign upload URL.");
      setF((p) => ({ ...p, video_url: signed.signedUrl }));
      notify.success("File uploaded.");
    } catch (e) {
      notify.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!f.title.trim()) return;
    setBusy(true);
    try {
      await saveFn({
        data: {
          id: lessonId,
          module_id: moduleId,
          title: f.title.trim(),
          kind: f.kind,
          media_type: f.kind === "quiz" ? null : f.media_type,
          video_url: f.kind === "quiz" ? "" : f.video_url,
          duration: f.duration,
          blurb: f.blurb,
          quiz_pass_threshold: Number(f.quiz_pass_threshold) || 0.75,
        },
      });
      notify.success("Lesson saved.");
      onSaved();
    } catch (e) {
      notify.error("Couldn't save. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={lessonId ? "Edit lesson" : "New lesson"}
      width={620}
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={!f.title.trim()} loading={busy}>Save</Button></>}
    >
      <div className="space-y-4">
        <FormGrid>
          <Field label="Title" required><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Type">
            <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as any })}>
              <option value="lesson">Lesson (video/audio)</option>
              <option value="quiz">Quiz</option>
            </Select>
          </Field>
        </FormGrid>

        {f.kind === "lesson" ? (
          <>
            <FormGrid>
              <Field label="Media">
                <Select value={f.media_type} onChange={(e) => setF({ ...f, media_type: e.target.value as any })}>
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                </Select>
              </Field>
              <Field label="Duration"><Input placeholder="12:30" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} /></Field>
            </FormGrid>
            <Field label="Media URL" hint="Paste a URL or upload a file below.">
              <Input value={f.video_url} onChange={(e) => setF({ ...f, video_url: e.target.value })} placeholder="https://…" />
            </Field>
            <label className="inline-flex cursor-pointer items-center gap-2 text-[13px]" style={{ color: "var(--p-text-2)" }}>
              <span className={"p-focus inline-flex h-8 items-center rounded-[10px] border px-3 text-[13px]"} style={{ borderColor: "var(--p-border)", background: "var(--p-raised)" }}>
                {uploading ? "Uploading…" : "Upload file"}
              </span>
              <input type="file" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); }} />
            </label>
            <Field label="Blurb / notes"><Textarea value={f.blurb} onChange={(e) => setF({ ...f, blurb: e.target.value })} /></Field>
          </>
        ) : (
          <>
            <Field label="Pass threshold" hint="0–1 (0.75 = 75% to pass)">
              <Input type="number" step="0.05" min="0" max="1" value={String(f.quiz_pass_threshold)} onChange={(e) => setF({ ...f, quiz_pass_threshold: Number(e.target.value) })} />
            </Field>
            {lessonId ? (
              <QuestionsEditor lessonId={lessonId} questions={questions.filter((qq) => qq.lesson_id === lessonId)} />
            ) : (
              <p className="p-muted">Save the quiz first, then add questions.</p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function QuestionsEditor({ lessonId, questions }: { lessonId: string; questions: any[] }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(adminUpsertQuestion);
  const delFn = useServerFn(adminDeleteNode);
  const [text, setText] = useState("");
  const [opts, setOpts] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["academy", "course"] });

  async function add() {
    const clean = opts.map((o) => o.trim()).filter(Boolean);
    if (!text.trim() || clean.length < 2) { notify.error("Add a question and at least 2 options."); return; }
    await saveFn({ data: { lesson_id: lessonId, question_text: text.trim(), options: clean, correct_index: Math.min(correct, clean.length - 1) } });
    setText(""); setOpts(["", "", "", ""]); setCorrect(0);
    invalidate();
  }
  async function remove(id: string) {
    await delFn({ data: { kind: "question", id } });
    invalidate();
  }

  return (
    <div className="space-y-3">
      <div className="p-label">Questions</div>
      {questions.map((qq, i) => (
        <div key={qq.id} className="p-panel p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[13.5px] font-medium">{i + 1}. {qq.question_text}</span>
            <button onClick={() => remove(qq.id)} className="p-focus" style={{ color: "var(--p-text-3)" }}><Trash2 size={13} /></button>
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {(qq.options ?? []).map((o: string, oi: number) => (
              <li key={oi} className="text-[12.5px]" style={{ color: oi === qq.correct_index ? "var(--p-green)" : "var(--p-text-2)" }}>
                {oi === qq.correct_index ? "✓ " : "• "}{o}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="p-panel space-y-2 p-3">
        <Input placeholder="Question text" value={text} onChange={(e) => setText(e.target.value)} />
        {opts.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <Radio name="correct" checked={correct === i} onChange={() => setCorrect(i)} label="" aria-label={`Mark option ${i + 1} correct`} />
            <Input placeholder={`Option ${i + 1}`} value={o} onChange={(e) => setOpts(opts.map((x, xi) => (xi === i ? e.target.value : x)))} />
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={add}><Plus size={13} /> Add question</Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Library                                                                    */
/* -------------------------------------------------------------------------- */

function LibraryBuilder() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListLibrary);
  const delFn = useServerFn(adminDeleteResource);
  const q = useQuery({ queryKey: ["academy", "library"], queryFn: () => listFn() });
  const [edit, setEdit] = useState<null | { id?: string }>(null);
  const resources = (q.data?.resources ?? []) as any[];
  const tags = (q.data?.tags ?? []) as any[];

  async function del(id: string) {
    if (!confirm("Delete this resource?")) return;
    await delFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["academy", "library"] });
    notify.success("Resource deleted.");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-start">
      <Panel
        title="Library resources"
        actions={<Button variant="primary" size="sm" onClick={() => setEdit({})}><Plus size={14} /> New</Button>}
        padded={false}
      >
        {resources.length === 0 ? (
          <EmptyState title="No resources yet" description="Add your first library resource." />
        ) : (
          <TableWrap className="border-0">
            <Table>
              <THead><TH>Title</TH><TH>Type</TH><TH>Tags</TH><TH align="right" /></THead>
              <tbody>
                {resources.map((r) => (
                  <TR key={r.id} onClick={() => setEdit({ id: r.id })}>
                    <TD className="p-card-title">{r.title} {r.is_required && <Badge tone="gold" className="ml-1">Req</Badge>}</TD>
                    <TD><Badge tone="blue">{r.type}</Badge></TD>
                    <TD className="p-muted">{(r.tags ?? []).join(", ") || "—"}</TD>
                    <TD align="right"><button onClick={(e) => { e.stopPropagation(); del(r.id); }} className="p-focus" style={{ color: "var(--p-text-3)" }}><Trash2 size={15} /></button></TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>

      <TagManager tags={tags} />

      {edit && (
        <ResourceModal
          resource={resources.find((r) => r.id === edit.id)}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); qc.invalidateQueries({ queryKey: ["academy", "library"] }); }}
        />
      )}
    </div>
  );
}

function ResourceModal({ resource, onClose, onSaved }: { resource?: any; onClose: () => void; onSaved: () => void }) {
  const saveFn = useServerFn(adminUpsertResource);
  const [f, setF] = useState({
    title: resource?.title ?? "",
    description: resource?.description ?? "",
    type: (resource?.type ?? "link") as "file" | "video" | "audio" | "link",
    url: resource?.url ?? "",
    is_required: !!resource?.is_required,
    section: (resource?.section ?? "library") as "library" | "presentation",
    category: (resource?.category ?? "") as string,
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `library/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("academy").upload(path, file, { upsert: true });
      if (error) throw error;
      // The academy bucket is private, so store a long-lived signed URL.
      const { data: signed, error: signErr } = await supabase.storage
        .from("academy")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Could not sign upload URL.");
      setF((p) => ({ ...p, url: signed.signedUrl }));
      notify.success("File uploaded.");
    } catch (e) {
      notify.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!f.title.trim()) return;
    setBusy(true);
    try {
      await saveFn({
        data: {
          id: resource?.id,
          title: f.title.trim(),
          description: f.description,
          type: f.type,
          url: f.url,
          is_required: f.is_required,
          section: f.section,
          category: f.category.trim(),
        },
      });
      notify.success("Resource saved.");
      onSaved();
    } catch (e) {
      notify.error("Couldn't save. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={resource ? "Edit resource" : "New resource"}
      width={560}
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={busy || !f.title.trim()}>{busy ? "Saving…" : "Save"}</Button></>}
    >
      <div className="space-y-4">
        <Field label="Title" required><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <FormGrid>
          <Field label="Type">
            <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as any })}>
              <option value="link">Link</option>
              <option value="file">File</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
            </Select>
          </Field>
          <Field label="Required">
            <label className="mt-2 inline-flex items-center gap-2 text-[13.5px]" style={{ color: "var(--p-text)" }}>
              <input type="checkbox" checked={f.is_required} onChange={(e) => setF({ ...f, is_required: e.target.checked })} /> Required
            </label>
          </Field>
        </FormGrid>
        <Field label={f.type === "link" ? "URL" : "URL (or upload below)"}>
          <Input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://…" />
        </Field>
        {f.type !== "link" && (
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px]" style={{ color: "var(--p-text-2)" }}>
            <span className="p-focus inline-flex h-8 items-center rounded-[10px] border px-3 text-[13px]" style={{ borderColor: "var(--p-border)", background: "var(--p-raised)" }}>
              {uploading ? "Uploading…" : "Upload file"}
            </span>
            <input type="file" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); }} />
          </label>
        )}
        <FormGrid>
          <Field label="Section">
            <Select value={f.section} onChange={(e) => setF({ ...f, section: e.target.value as any })}>
              <option value="library">Library</option>
              <option value="presentation">Recorded Presentation</option>
            </Select>
          </Field>
          <Field label="Category" hint="Optional folder, e.g. Scripts, Systems, Carrier Resources.">
            <Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Scripts" />
          </Field>
        </FormGrid>
      </div>
    </Modal>
  );
}

function TagManager({ tags }: { tags: any[] }) {
  const qc = useQueryClient();
  const renameFn = useServerFn(adminRenameTag);
  const delFn = useServerFn(adminDeleteTag);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["academy", "library"] });

  async function rename(id: string, current: string) {
    const name = prompt("Rename tag", current);
    if (!name?.trim() || name.trim() === current) return;
    await renameFn({ data: { id, name: name.trim() } });
    invalidate();
  }
  async function remove(id: string) {
    if (!confirm("Delete this tag? It will be removed from all resources.")) return;
    await delFn({ data: { id } });
    invalidate();
  }

  return (
    <Panel title="Tags" description="Keep the tag set tidy.">
      {tags.length === 0 ? (
        <p className="p-muted">No tags yet.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {tags.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 rounded-[8px] px-2 py-1.5" style={{ background: "var(--p-hover)" }}>
              <span className="text-[13px]">{t.name}</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => rename(t.id, t.name)} className="p-focus" style={{ color: "var(--p-text-3)" }}><Pencil size={13} /></button>
                <button onClick={() => remove(t.id)} className="p-focus" style={{ color: "var(--p-text-3)" }}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
