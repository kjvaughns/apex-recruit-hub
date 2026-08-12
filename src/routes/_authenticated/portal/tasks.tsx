import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ListChecks } from "lucide-react";
import { PortalShell } from "@/components/vantage/portal-shell";
import { listTasks, createTask, toggleTask, deleteTask } from "@/lib/portal.functions";
import { DateTimePicker } from "@/components/vantage/date-time-picker";
import {
  PageHeader,
  PageBody,
  Panel,
  Button,
  Toolbar,
  SegmentedControl,
  TableWrap,
  Table,
  THead,
  TH,
  TR,
  TD,
  EmptyState,
  ErrorState,
  TableSkeleton,
  ListSkeleton,
  Input,
  Textarea,
  Select,
  Field,
  Badge,
  notify,
  type BadgeTone,
} from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/tasks")({
  head: () => ({
    meta: [{ title: "Tasks — Vantage Portal" }, { name: "robots", content: "noindex" }],
  }),
  component: TasksPage,
});

type Scope = "mine" | "all";
type Status = "open" | "done" | "all";

const PRIORITY_TONE: Record<string, BadgeTone> = {
  low: "neutral",
  normal: "blue",
  high: "amber",
};

function TasksPage() {
  const qc = useQueryClient();
  const list = useServerFn(listTasks);
  const create = useServerFn(createTask);
  const toggle = useServerFn(toggleTask);
  const remove = useServerFn(deleteTask);

  const [scope, setScope] = useState<Scope>("mine");
  const [status, setStatus] = useState<Status>("open");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [notes, setNotes] = useState("");

  const key = ["tasks", scope, status];
  const q = useQuery({ queryKey: key, queryFn: () => list({ data: { scope, status } }) });

  const createM = useMutation({
    mutationFn: () =>
      create({
        data: {
          title: title.trim(),
          notes: notes.trim() || undefined,
          due_at: due ? new Date(due).toISOString() : null,
          priority,
        },
      }),
    onSuccess: () => {
      setTitle("");
      setDue("");
      setNotes("");
      setPriority("normal");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      notify.success("Task created.");
    },
    onError: () => notify.error("Couldn't create that task. Please try again."),
  });

  const toggleM = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: () => notify.error("Couldn't update that task. Please try again."),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      notify.success("Task deleted.");
    },
    onError: () => notify.error("Couldn't delete that task. Please try again."),
  });

  const tasks = q.data?.tasks ?? [];

  return (
    <PortalShell>
      <PageBody>
        <PageHeader title="Tasks" description="Focus" />

        <div className="space-y-4">
          <Panel title="New task">
            <div className="grid gap-3 md:grid-cols-[1.6fr_1fr_.8fr_auto]">
              <Field label="Title" className="md:contents md:[&>span]:hidden">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task title"
                  aria-label="Task title"
                />
              </Field>
              <Field label="Due" className="md:contents md:[&>span]:hidden">
                <DateTimePicker value={due || null} onChange={(iso) => setDue(iso ?? "")} />
              </Field>
              <Field label="Priority" className="md:contents md:[&>span]:hidden">
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as "low" | "normal" | "high")}
                  aria-label="Priority"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </Select>
              </Field>
              <Button
                variant="primary"
                className="min-h-11 md:min-h-0"
                loading={createM.isPending}
                onClick={() => {
                  if (!title.trim()) return;
                  // Confirm before scheduling a task in the past (spec §20).
                  if (due && new Date(due) < new Date()) {
                    if (!window.confirm("This due date is in the past. Create the task anyway?"))
                      return;
                  }
                  createM.mutate();
                }}
                disabled={!title.trim() || createM.isPending}
              >
                Add
              </Button>
            </div>
            <Field label="Notes" className="mt-3">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                rows={2}
              />
            </Field>
          </Panel>

          <Toolbar>
            <SegmentedControl
              size="sm"
              value={scope}
              onChange={setScope}
              options={[
                { value: "mine", label: "Mine" },
                { value: "all", label: "All" },
              ]}
            />
            <div className="ml-auto">
              <SegmentedControl
                size="sm"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "open", label: "Open" },
                  { value: "done", label: "Done" },
                  { value: "all", label: "All" },
                ]}
              />
            </div>
          </Toolbar>

          {q.isError ? (
            <div className="p-panel">
              <ErrorState description="We couldn't load your tasks right now." onRetry={() => q.refetch()} />
            </div>
          ) : (
            <>
              {/* Mobile: stacked task cards (the 6-column table is too wide for phones). */}
              <div className="flex flex-col gap-2.5 sm:hidden">
                {q.isLoading ? (
                  <div className="p-panel p-4">
                    <ListSkeleton rows={4} />
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="p-panel p-2">
                    <TasksEmptyState />
                  </div>
                ) : (
                  tasks.map((t: any) => {
                    const done = !!t.completed_at;
                    const overdue = t.due_at && !done && new Date(t.due_at) < new Date();
                    return (
                      <div key={t.id} className="p-panel p-3.5">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleM.mutate({ id: t.id, done: !done })}
                            className="p-focus mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border text-[12px]"
                            style={
                              done
                                ? { borderColor: "var(--p-gold)", background: "var(--p-gold-soft)", color: "var(--p-gold)" }
                                : { borderColor: "var(--p-border-strong)", color: "transparent" }
                            }
                            aria-label={done ? "Mark open" : "Mark done"}
                          >
                            ✓
                          </button>
                          <div className="min-w-0 flex-1">
                            <div
                              className="p-body font-medium"
                              style={done ? { color: "var(--p-text-3)", textDecoration: "line-through" } : undefined}
                            >
                              {t.title}
                            </div>
                            {t.notes && <div className="p-muted mt-0.5">{t.notes}</div>}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {t.due_at && (
                                <Badge tone={overdue ? "red" : "neutral"}>
                                  {new Date(t.due_at).toLocaleString()}
                                </Badge>
                              )}
                              <Badge tone={PRIORITY_TONE[t.priority] ?? "neutral"} className="capitalize">{t.priority}</Badge>
                              {t.applicants && (
                                <span className="p-muted text-[12px]">
                                  {t.applicants.first_name} {t.applicants.last_name}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="min-h-11" onClick={() => deleteM.mutate(t.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="hidden sm:block">
                {q.isLoading ? (
                  <TableSkeleton rows={6} cols={5} />
                ) : tasks.length === 0 ? (
                  <div className="p-panel">
                    <TasksEmptyState />
                  </div>
                ) : (
                  <TableWrap>
                    <Table>
                      <THead>
                        <TH></TH>
                        <TH>Task</TH>
                        <TH>Due</TH>
                        <TH>Priority</TH>
                        <TH>Applicant</TH>
                        <TH align="right">Actions</TH>
                      </THead>
                      <tbody>
                        {tasks.map((t: any) => {
                          const done = !!t.completed_at;
                          const overdue = t.due_at && !done && new Date(t.due_at) < new Date();
                          return (
                            <TR key={t.id}>
                              <TD>
                                <button
                                  onClick={() => toggleM.mutate({ id: t.id, done: !done })}
                                  className="p-focus grid h-5 w-5 place-items-center rounded-md border text-[11px]"
                                  style={
                                    done
                                      ? { borderColor: "var(--p-gold)", background: "var(--p-gold-soft)", color: "var(--p-gold)" }
                                      : { borderColor: "var(--p-border-strong)", color: "transparent" }
                                  }
                                  aria-label={done ? "Mark open" : "Mark done"}
                                >
                                  ✓
                                </button>
                              </TD>
                              <TD>
                                <div
                                  className="p-body font-medium"
                                  style={done ? { color: "var(--p-text-3)", textDecoration: "line-through" } : undefined}
                                >
                                  {t.title}
                                </div>
                                {t.notes && <div className="p-muted mt-0.5">{t.notes}</div>}
                              </TD>
                              <TD>
                                {t.due_at ? (
                                  <Badge tone={overdue ? "red" : "neutral"}>{new Date(t.due_at).toLocaleString()}</Badge>
                                ) : (
                                  <span className="p-muted">—</span>
                                )}
                              </TD>
                              <TD>
                                <Badge tone={PRIORITY_TONE[t.priority] ?? "neutral"} className="capitalize">{t.priority}</Badge>
                              </TD>
                              <TD>
                                {t.applicants ? (
                                  <span className="p-muted">
                                    {t.applicants.first_name} {t.applicants.last_name}
                                  </span>
                                ) : (
                                  <span className="p-muted">—</span>
                                )}
                              </TD>
                              <TD align="right">
                                <Button variant="ghost" size="sm" onClick={() => deleteM.mutate(t.id)}>
                                  Delete
                                </Button>
                              </TD>
                            </TR>
                          );
                        })}
                      </tbody>
                    </Table>
                  </TableWrap>
                )}
              </div>
            </>
          )}
        </div>
      </PageBody>
    </PortalShell>
  );
}

function TasksEmptyState() {
  return (
    <EmptyState
      icon={<ListChecks size={16} />}
      title="No tasks yet"
      description="Tasks help you keep track of follow-ups and next steps for your pipeline. Add your first task above to get started."
    />
  );
}
