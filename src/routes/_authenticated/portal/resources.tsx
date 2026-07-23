import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";
import { listResources, upsertResource, deleteResource, getMe } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/portal/resources")({
  head: () => ({ meta: [{ title: "Resources — APEX Portal" }, { name: "robots", content: "noindex" }] }),
  component: ResourcesPage,
});

function ResourcesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listResources);
  const upsert = useServerFn(upsertResource);
  const remove = useServerFn(deleteResource);
  const me = useServerFn(getMe);

  const meQ = useQuery({ queryKey: ["me"], queryFn: () => me() });
  const isAdmin = (meQ.data?.roles ?? []).some((r: string) => r === "admin" || r === "super_admin");

  const q = useQuery({ queryKey: ["resources"], queryFn: () => list() });
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);

  const resources = q.data?.resources ?? [];
  const categories = useMemo(() => {
    const s = new Set<string>();
    resources.forEach((r: any) => s.add(r.category));
    return ["all", ...Array.from(s)];
  }, [resources]);

  const filtered = resources.filter((r: any) => {
    if (category !== "all" && r.category !== category) return false;
    if (search && !((r.title + " " + (r.description ?? "")).toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const saveM = useMutation({
    mutationFn: (v: any) => upsert({ data: v }),
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ["resources"] }); },
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resources"] }),
  });

  return (
    <PortalShell>
      <PortalHeader
        kicker="Training"
        title="Resources"
        actions={
          isAdmin && (
            <button
              onClick={() => setEditing({ title: "", description: "", category: "general", url: "", kind: "link", position: 0, is_published: true })}
              className="apx-btn-primary px-4 py-2 text-[13px]"
            >
              + New resource
            </button>
          )
        }
      />
      <div className="px-6 py-8 md:px-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resources…"
            className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-apex-ivory outline-none focus:border-apex-gold/50"
          />
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1.5 text-[12px] capitalize ${category === c ? "border-apex-gold/40 bg-apex-gold/10 text-apex-gold" : "border-white/10 text-apex-dim hover:text-apex-ivory"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {q.isLoading ? (
          <div className="text-center text-apex-dim">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-10 text-center text-apex-dim">
            No resources.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((r: any) => (
              <div key={r.id} className="group flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition hover:border-apex-gold/25">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-apex-gold">{r.category}</span>
                  {!r.is_published && <span className="text-[10px] uppercase tracking-widest text-apex-faint">Draft</span>}
                </div>
                <h3 className="font-display text-xl leading-tight">{r.title}</h3>
                {r.description && <p className="mt-2 text-[13px] text-apex-dim">{r.description}</p>}
                <div className="mt-4 flex items-center justify-between gap-2">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-apex-gold hover:underline">
                      Open →
                    </a>
                  ) : <span />}
                  {isAdmin && (
                    <div className="flex gap-2 text-[12px]">
                      <button onClick={() => setEditing(r)} className="text-apex-dim hover:text-apex-ivory">Edit</button>
                      <button onClick={() => confirm("Delete this resource?") && deleteM.mutate(r.id)} className="text-apex-faint hover:text-red-400">Delete</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEditing(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a0a0a] p-6">
            <div className="mb-4 font-display text-xl">{editing.id ? "Edit resource" : "New resource"}</div>
            <div className="space-y-3">
              <Field label="Title">
                <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm" />
              </Field>
              <Field label="Description">
                <textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm" />
                </Field>
                <Field label="Kind">
                  <select value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value })} className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm">
                    <option value="link">Link</option>
                    <option value="doc">Doc</option>
                    <option value="video">Video</option>
                  </select>
                </Field>
              </div>
              <Field label="URL">
                <input value={editing.url ?? ""} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://…" className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Position">
                  <input type="number" value={editing.position ?? 0} onChange={(e) => setEditing({ ...editing, position: Number(e.target.value) })} className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm" />
                </Field>
                <label className="flex items-end gap-2 pb-2 text-[13px] text-apex-dim">
                  <input type="checkbox" checked={!!editing.is_published} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} />
                  Published
                </label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="apx-btn-ghost px-4 py-2 text-[13px]">Cancel</button>
              <button
                onClick={() => saveM.mutate({
                  id: editing.id,
                  title: editing.title,
                  description: editing.description || null,
                  category: editing.category || "general",
                  url: editing.url || null,
                  kind: editing.kind || "link",
                  position: editing.position ?? 0,
                  is_published: !!editing.is_published,
                })}
                disabled={!editing.title?.trim() || saveM.isPending}
                className="apx-btn-primary px-4 py-2 text-[13px] disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-apex-faint">{label}</div>
      {children}
    </label>
  );
}
