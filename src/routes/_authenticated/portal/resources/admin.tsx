import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/apex/portal-shell";
import {
  adminListResources, adminUpsertResource, adminDeleteResource,
  adminUpsertPresenter, adminDeletePresenter,
  adminUpsertRecording, adminDeleteRecording,
  adminListQuickLinks, adminUpsertQuickLink, adminDeleteQuickLink,
  listPresentersWithRecordings,
} from "@/lib/resources.functions";
import { getMe } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/portal/resources/admin")({
  head: () => ({ meta: [{ title: "Manage Resources — APEX Portal" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    const me = await getMe();
    const roles = me?.roles ?? [];
    if (!roles.some((r: string) => r === "admin" || r === "super_admin")) {
      throw redirect({ to: "/portal/resources" });
    }
  },
  component: AdminPage,
});

type Tab = "resources" | "presenters" | "recordings" | "quicklinks";

function AdminPage() {
  const [tab, setTab] = useState<Tab>("resources");
  return (
    <PortalShell>
      <div className="mx-auto max-w-[1240px] px-6 pb-20 md:px-8">
        <div className="flex items-center justify-between pt-6">
          <Link to="/portal/resources" className="rounded-lg border border-white/[0.09] px-3 py-1.5 text-[13px] font-semibold text-apex-dim hover:border-apex-gold hover:text-apex-gold">
            ← Hub
          </Link>
        </div>
        <div className="pt-8 pb-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-apex-gold">Admin</p>
          <h1 className="mt-3 font-display text-[clamp(32px,5vw,48px)] leading-[0.98]">Manage hub content</h1>
        </div>
        <div className="mb-6 flex flex-wrap gap-1 border-b border-white/[0.09]">
          {(["resources","presenters","recordings","quicklinks"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-4 py-3 text-[14px] font-semibold capitalize transition ${
                tab === t ? "text-apex-ivory" : "text-apex-dim hover:text-apex-ivory"
              }`}
            >
              {t === "quicklinks" ? "Quick Links" : t}
              {tab === t && <span className="absolute inset-x-4 -bottom-px h-0.5 bg-apex-gold" />}
            </button>
          ))}
        </div>

        {tab === "resources" && <ResourcesAdmin />}
        {tab === "presenters" && <PresentersAdmin />}
        {tab === "recordings" && <RecordingsAdmin />}
        {tab === "quicklinks" && <QuickLinksAdmin />}
      </div>
    </PortalShell>
  );
}

/* -------------------- Resources -------------------- */

function ResourcesAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(adminListResources);
  const save = useServerFn(adminUpsertResource);
  const del = useServerFn(adminDeleteResource);
  const q = useQuery({ queryKey: ["admin-resources"], queryFn: () => list() });
  const [editing, setEditing] = useState<any | null>(null);
  const saveM = useMutation({
    mutationFn: (v: any) => save({ data: v }),
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ["admin-resources"] }); qc.invalidateQueries({ queryKey: ["library"] }); qc.invalidateQueries({ queryKey: ["resource-hub"] }); },
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-resources"] }); qc.invalidateQueries({ queryKey: ["library"] }); },
  });

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setEditing({ title: "", description: "", long: "", category: "general", type: "guide", url: "", cta: "Open", meta: "", tags: [], display_date: "", position: 0, is_published: true })}
          className="rounded-lg bg-apex-gold px-4 py-2 text-[13px] font-bold text-black hover:brightness-110"
        >
          + New resource
        </button>
      </div>
      {q.isLoading ? (
        <div className="text-center text-apex-dim">Loading…</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.09]">
          <table className="w-full text-[13.5px]">
            <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-[0.18em] text-apex-faint">
              <tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Published</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {(q.data?.resources ?? []).map((r: any) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-apex-ivory">{r.title}</td>
                  <td className="px-4 py-3 text-apex-dim uppercase">{r.type}</td>
                  <td className="px-4 py-3 text-apex-dim">{r.category}</td>
                  <td className="px-4 py-3 text-apex-dim">{r.is_published ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-right text-[12px]">
                    <button onClick={() => setEditing(r)} className="mr-3 text-apex-dim hover:text-apex-ivory">Edit</button>
                    <button onClick={() => confirm("Delete resource?") && delM.mutate(r.id)} className="text-apex-faint hover:text-red-400">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? "Edit resource" : "New resource"}
          onSave={() => saveM.mutate({
            id: editing.id, title: editing.title,
            description: editing.description || null, long: editing.long || null,
            category: editing.category || "general", type: editing.type || "guide",
            url: editing.url || null, cta: editing.cta || null, meta: editing.meta || null,
            tags: Array.isArray(editing.tags) ? editing.tags : String(editing.tags || "").split(",").map((s: string) => s.trim()).filter(Boolean),
            display_date: editing.display_date || null, position: Number(editing.position ?? 0),
            is_published: !!editing.is_published,
          })}
          canSave={!!editing.title?.trim()}
        >
          <Field label="Title"><input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={inputCls} /></Field>
          <Field label="Description"><textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={inputCls} /></Field>
          <Field label="Long description"><textarea rows={4} value={editing.long ?? ""} onChange={(e) => setEditing({ ...editing, long: e.target.value })} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })} className={inputCls}>
                <option value="video">Video</option><option value="pdf">PDF</option><option value="training">Training</option><option value="guide">Guide</option><option value="course">Course</option>
              </select>
            </Field>
            <Field label="Category"><input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className={inputCls} /></Field>
          </div>
          <Field label="URL"><input value={editing.url ?? ""} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://…" className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CTA label"><input value={editing.cta ?? ""} onChange={(e) => setEditing({ ...editing, cta: e.target.value })} placeholder="Open PDF" className={inputCls} /></Field>
            <Field label="Meta"><input value={editing.meta ?? ""} onChange={(e) => setEditing({ ...editing, meta: e.target.value })} placeholder="PDF · 3 pages" className={inputCls} /></Field>
          </div>
          <Field label="Tags (comma-separated)">
            <input
              value={Array.isArray(editing.tags) ? editing.tags.join(", ") : (editing.tags ?? "")}
              onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Display date"><input type="date" value={editing.display_date ?? ""} onChange={(e) => setEditing({ ...editing, display_date: e.target.value })} className={inputCls} /></Field>
            <Field label="Position"><input type="number" value={editing.position ?? 0} onChange={(e) => setEditing({ ...editing, position: Number(e.target.value) })} className={inputCls} /></Field>
            <label className="flex items-end gap-2 pb-2 text-[13px] text-apex-dim">
              <input type="checkbox" checked={!!editing.is_published} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} />
              Published
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* -------------------- Presenters -------------------- */

function PresentersAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(listPresentersWithRecordings);
  const save = useServerFn(adminUpsertPresenter);
  const del = useServerFn(adminDeletePresenter);
  const q = useQuery({ queryKey: ["admin-presenters"], queryFn: () => list() });
  const [editing, setEditing] = useState<any | null>(null);
  const saveM = useMutation({
    mutationFn: (v: any) => save({ data: v }),
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ["admin-presenters"] }); qc.invalidateQueries({ queryKey: ["presentations"] }); qc.invalidateQueries({ queryKey: ["resource-hub"] }); },
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-presenters"] }),
  });
  const presenters = q.data?.presenters ?? [];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setEditing({ slug: "", name: "", role: "", initials: "", sort_order: presenters.length + 1, is_active: true })} className="rounded-lg bg-apex-gold px-4 py-2 text-[13px] font-bold text-black hover:brightness-110">
          + New presenter
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/[0.09]">
        <table className="w-full text-[13.5px]">
          <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-[0.18em] text-apex-faint">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Slug</th><th className="px-4 py-3">Active</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {presenters.map((p: any) => (
              <tr key={p.id}>
                <td className="px-4 py-3 text-apex-ivory">{p.initials} · {p.name}</td>
                <td className="px-4 py-3 text-apex-dim">{p.role}</td>
                <td className="px-4 py-3 text-apex-faint">{p.slug}</td>
                <td className="px-4 py-3 text-apex-dim">{p.is_active ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-right text-[12px]">
                  <button onClick={() => setEditing(p)} className="mr-3 text-apex-dim hover:text-apex-ivory">Edit</button>
                  <button onClick={() => confirm("Delete presenter and their recordings?") && delM.mutate(p.id)} className="text-apex-faint hover:text-red-400">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? "Edit presenter" : "New presenter"}
          onSave={() => saveM.mutate({
            id: editing.id, slug: editing.slug, name: editing.name, role: editing.role || null,
            initials: editing.initials, sort_order: Number(editing.sort_order ?? 0), is_active: !!editing.is_active,
          })}
          canSave={!!editing.name?.trim() && !!editing.slug?.trim() && !!editing.initials?.trim()}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inputCls} /></Field>
            <Field label="Initials"><input maxLength={3} value={editing.initials} onChange={(e) => setEditing({ ...editing, initials: e.target.value.toUpperCase() })} className={inputCls} /></Field>
          </div>
          <Field label="Slug"><input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase() })} className={inputCls} /></Field>
          <Field label="Role"><input value={editing.role ?? ""} onChange={(e) => setEditing({ ...editing, role: e.target.value })} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sort order"><input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className={inputCls} /></Field>
            <label className="flex items-end gap-2 pb-2 text-[13px] text-apex-dim"><input type="checkbox" checked={!!editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />Active</label>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* -------------------- Recordings -------------------- */

function RecordingsAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(listPresentersWithRecordings);
  const save = useServerFn(adminUpsertRecording);
  const del = useServerFn(adminDeleteRecording);
  const q = useQuery({ queryKey: ["admin-recordings"], queryFn: () => list() });
  const [editing, setEditing] = useState<any | null>(null);
  const saveM = useMutation({
    mutationFn: (v: any) => save({ data: v }),
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ["admin-recordings"] }); qc.invalidateQueries({ queryKey: ["presentations"] }); qc.invalidateQueries({ queryKey: ["resource-hub"] }); },
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-recordings"] }),
  });
  const presenters = q.data?.presenters ?? [];
  const recordings = q.data?.recordings ?? [];
  const nameOf = (id: string) => presenters.find((p: any) => p.id === id)?.name ?? "—";

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          disabled={presenters.length === 0}
          onClick={() => setEditing({ presenter_id: presenters[0]?.id, title: "", topic: "", description: "", video_url: "", audio: false, duration: "", recorded_on: "", position: recordings.length + 1, is_published: true })}
          className="rounded-lg bg-apex-gold px-4 py-2 text-[13px] font-bold text-black hover:brightness-110 disabled:opacity-40"
        >
          + New recording
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/[0.09]">
        <table className="w-full text-[13.5px]">
          <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-[0.18em] text-apex-faint">
            <tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Presenter</th><th className="px-4 py-3">Topic</th><th className="px-4 py-3">Date</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {recordings.map((r: any) => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-apex-ivory">{r.title}</td>
                <td className="px-4 py-3 text-apex-dim">{nameOf(r.presenter_id)}</td>
                <td className="px-4 py-3 text-apex-dim">{r.topic}</td>
                <td className="px-4 py-3 text-apex-faint">{r.recorded_on}</td>
                <td className="px-4 py-3 text-right text-[12px]">
                  <button onClick={() => setEditing(r)} className="mr-3 text-apex-dim hover:text-apex-ivory">Edit</button>
                  <button onClick={() => confirm("Delete recording?") && delM.mutate(r.id)} className="text-apex-faint hover:text-red-400">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? "Edit recording" : "New recording"}
          onSave={() => saveM.mutate({
            id: editing.id, presenter_id: editing.presenter_id,
            title: editing.title, topic: editing.topic || null, description: editing.description || null,
            video_url: editing.video_url || null, audio: !!editing.audio,
            duration: editing.duration || null, recorded_on: editing.recorded_on || null,
            position: Number(editing.position ?? 0), is_published: !!editing.is_published,
          })}
          canSave={!!editing.title?.trim() && !!editing.presenter_id}
        >
          <Field label="Presenter">
            <select value={editing.presenter_id} onChange={(e) => setEditing({ ...editing, presenter_id: e.target.value })} className={inputCls}>
              {presenters.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Title"><input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Topic"><input value={editing.topic ?? ""} onChange={(e) => setEditing({ ...editing, topic: e.target.value })} className={inputCls} /></Field>
            <Field label="Duration (mm:ss)"><input value={editing.duration ?? ""} onChange={(e) => setEditing({ ...editing, duration: e.target.value })} placeholder="12:45" className={inputCls} /></Field>
          </div>
          <Field label="Description"><textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={inputCls} /></Field>
          <Field label="Video URL (Google Drive /preview or YouTube embed)">
            <input value={editing.video_url ?? ""} onChange={(e) => setEditing({ ...editing, video_url: e.target.value })} placeholder="https://drive.google.com/file/d/…/preview" className={inputCls} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Recorded on"><input type="date" value={editing.recorded_on ?? ""} onChange={(e) => setEditing({ ...editing, recorded_on: e.target.value })} className={inputCls} /></Field>
            <Field label="Position"><input type="number" value={editing.position ?? 0} onChange={(e) => setEditing({ ...editing, position: Number(e.target.value) })} className={inputCls} /></Field>
            <label className="flex items-end gap-2 pb-2 text-[13px] text-apex-dim"><input type="checkbox" checked={!!editing.audio} onChange={(e) => setEditing({ ...editing, audio: e.target.checked })} />Audio only</label>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-apex-dim"><input type="checkbox" checked={!!editing.is_published} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} />Published</label>
        </Modal>
      )}
    </div>
  );
}

/* -------------------- Quick Links -------------------- */

function QuickLinksAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(adminListQuickLinks);
  const save = useServerFn(adminUpsertQuickLink);
  const del = useServerFn(adminDeleteQuickLink);
  const q = useQuery({ queryKey: ["admin-quicklinks"], queryFn: () => list() });
  const [editing, setEditing] = useState<any | null>(null);
  const saveM = useMutation({
    mutationFn: (v: any) => save({ data: v }),
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ["admin-quicklinks"] }); qc.invalidateQueries({ queryKey: ["resource-hub"] }); },
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-quicklinks"] }),
  });
  const links = q.data?.links ?? [];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setEditing({ label: "", sub: "", url: "", position: links.length + 1, is_active: true })} className="rounded-lg bg-apex-gold px-4 py-2 text-[13px] font-bold text-black hover:brightness-110">
          + New quick link
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/[0.09]">
        <table className="w-full text-[13.5px]">
          <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-[0.18em] text-apex-faint">
            <tr><th className="px-4 py-3">Label</th><th className="px-4 py-3">Sub</th><th className="px-4 py-3">URL</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {links.map((l: any) => (
              <tr key={l.id}>
                <td className="px-4 py-3 text-apex-ivory">{l.label}</td>
                <td className="px-4 py-3 text-apex-dim">{l.sub}</td>
                <td className="px-4 py-3 text-apex-faint truncate max-w-[280px]">{l.url}</td>
                <td className="px-4 py-3 text-right text-[12px]">
                  <button onClick={() => setEditing(l)} className="mr-3 text-apex-dim hover:text-apex-ivory">Edit</button>
                  <button onClick={() => confirm("Delete link?") && delM.mutate(l.id)} className="text-apex-faint hover:text-red-400">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? "Edit quick link" : "New quick link"}
          onSave={() => saveM.mutate({
            id: editing.id, label: editing.label, sub: editing.sub || null,
            url: editing.url, position: Number(editing.position ?? 0), is_active: !!editing.is_active,
          })}
          canSave={!!editing.label?.trim() && !!editing.url?.trim()}
        >
          <Field label="Label"><input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} className={inputCls} /></Field>
          <Field label="Subtitle"><input value={editing.sub ?? ""} onChange={(e) => setEditing({ ...editing, sub: e.target.value })} className={inputCls} /></Field>
          <Field label="URL"><input value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Position"><input type="number" value={editing.position ?? 0} onChange={(e) => setEditing({ ...editing, position: Number(e.target.value) })} className={inputCls} /></Field>
            <label className="flex items-end gap-2 pb-2 text-[13px] text-apex-dim"><input type="checkbox" checked={!!editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />Active</label>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* -------------------- Shared modal / field -------------------- */

const inputCls = "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-apex-ivory outline-none focus:border-apex-gold/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-apex-faint">{label}</div>
      {children}
    </label>
  );
}

function Modal({ title, onClose, onSave, canSave, children }: { title: string; onClose: () => void; onSave: () => void; canSave: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/72 px-4 py-10" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0a0a0a] p-6">
        <div className="mb-4 font-display text-xl">{title}</div>
        <div className="space-y-3">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-[13px] text-apex-dim hover:text-apex-ivory">Cancel</button>
          <button onClick={onSave} disabled={!canSave} className="rounded-lg bg-apex-gold px-4 py-2 text-[13px] font-bold text-black hover:brightness-110 disabled:opacity-40">Save</button>
        </div>
      </div>
    </div>
  );
}
