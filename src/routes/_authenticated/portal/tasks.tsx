import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import { listTasks, createTask, toggleTask, deleteTask } from "@/lib/portal.functions";
import { DateTimePicker } from "@/components/apex/date-time-picker";

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
      <PortalHeader kicker="Focus" title="Tasks" />
      <div className="px-6 py-8 md:px-10 space-y-6">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="mb-3 text-[11px] uppercase tracking-[0.2em] text-apex-faint">
            New task
          </div>
          <div className="grid gap-3 md:grid-cols-[1.6fr_1fr_.8fr_auto]">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-apex-ivory outline-none focus:border-apex-gold/50"
            />
            <DateTimePicker value={due || null} onChange={(iso) => setDue(iso ?? "")} />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as "low" | "normal" | "high")}
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-apex-ivory"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
            <button
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
              className="apx-btn-primary px-4 py-2.5 text-[13px] disabled:opacity-40"
            >
              Add
            </button>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-apex-ivory outline-none focus:border-apex-gold/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip active={scope === "mine"} onClick={() => setScope("mine")}>
            Mine
          </Chip>
          <Chip active={scope === "all"} onClick={() => setScope("all")}>
            All
          </Chip>
          <div className="mx-2 h-5 w-px bg-white/10" />
          <Chip active={status === "open"} onClick={() => setStatus("open")}>
            Open
          </Chip>
          <Chip active={status === "done"} onClick={() => setStatus("done")}>
            Done
          </Chip>
          <Chip active={status === "all"} onClick={() => setStatus("all")}>
            All
          </Chip>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          {q.isLoading ? (
            <div className="p-8 text-center text-apex-dim">Loading tasks…</div>
          ) : tasks.length === 0 ? (
            <div className="p-10 text-center text-apex-dim">No tasks. Create your first above.</div>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {tasks.map((t: any) => {
                const done = !!t.completed_at;
                const overdue = t.due_at && !done && new Date(t.due_at) < new Date();
                return (
                  <li key={t.id} className="flex items-start gap-4 px-5 py-4">
                    <button
                      onClick={() => toggleM.mutate({ id: t.id, done: !done })}
                      className={`mt-1 h-5 w-5 flex-none rounded-md border ${done ? "border-apex-gold bg-apex-gold/20 text-apex-gold" : "border-white/25 text-transparent hover:border-apex-gold/50"}`}
                      aria-label={done ? "Mark open" : "Mark done"}
                    >
                      ✓
                    </button>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-[14px] font-medium ${done ? "text-apex-faint line-through" : "text-apex-ivory"}`}
                      >
                        {t.title}
                      </div>
                      {t.notes && <div className="mt-1 text-[13px] text-apex-dim">{t.notes}</div>}
                      <div className="mt-1.5 flex flex-wrap gap-3 text-[11.5px] text-apex-faint">
                        {t.due_at && (
                          <span className={overdue ? "text-red-400" : ""}>
                            Due {new Date(t.due_at).toLocaleString()}
                          </span>
                        )}
                        <span className="uppercase tracking-widest">{t.priority}</span>
                        {t.applicants && (
                          <span>
                            · {t.applicants.first_name} {t.applicants.last_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteM.mutate(t.id)}
                      className="text-[12px] text-apex-faint hover:text-red-400"
                    >
                      Delete
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </PortalShell>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-[12px] transition ${
        active
          ? "border-apex-gold/40 bg-apex-gold/10 text-apex-gold"
          : "border-white/10 text-apex-dim hover:border-white/25 hover:text-apex-ivory"
      }`}
    >
      {children}
    </button>
  );
}
