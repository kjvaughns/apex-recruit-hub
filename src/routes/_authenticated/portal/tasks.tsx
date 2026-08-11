import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
  Input,
  Textarea,
  Select,
} from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/tasks")({
  head: () => ({
    meta: [{ title: "Tasks — Vantage Portal" }, { name: "robots", content: "noindex" }],
  }),
  component: TasksPage,
});

type Scope = "mine" | "all";
type Status = "open" | "done" | "all";

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
    },
  });

  const toggleM = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const tasks = q.data?.tasks ?? [];

  return (
    <PortalShell>
      <PageBody>
        <PageHeader title="Tasks" description="Focus" />

        <div className="space-y-4">
          <Panel title="New task">
            <div className="grid gap-3 md:grid-cols-[1.6fr_1fr_.8fr_auto]">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
              />
              <DateTimePicker value={due || null} onChange={(iso) => setDue(iso ?? "")} />
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as "low" | "normal" | "high")}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </Select>
              <Button
                variant="primary"
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
            <Textarea
              className="mt-3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
            />
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
                {q.isLoading ? (
                  <TR>
                    <TD colSpan={6}>
                      <div className="p-body py-4 text-center">Loading tasks…</div>
                    </TD>
                  </TR>
                ) : tasks.length === 0 ? (
                  <TR>
                    <TD colSpan={6}>
                      <EmptyState title="No tasks" description="Create your first above." />
                    </TD>
                  </TR>
                ) : (
                  tasks.map((t: any) => {
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
                            <span className="p-muted" style={overdue ? { color: "var(--p-red)" } : undefined}>
                              {new Date(t.due_at).toLocaleString()}
                            </span>
                          ) : (
                            <span className="p-muted">—</span>
                          )}
                        </TD>
                        <TD>
                          <span className="p-muted uppercase tracking-wide">{t.priority}</span>
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
                  })
                )}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      </PageBody>
    </PortalShell>
  );
}
