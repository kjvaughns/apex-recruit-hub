import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import {
  adminListResources, adminUpsertResource, adminDeleteResource,
  adminUpsertPresenter, adminDeletePresenter,
  adminUpsertRecording, adminDeleteRecording,
  adminListQuickLinks, adminUpsertQuickLink, adminDeleteQuickLink,
  listPresentersWithRecordings,
} from "@/lib/resources.functions";
import { getMe } from "@/lib/portal.functions";
import {
  PageHeader, PageBody, Button, Tabs, TableWrap, Table, THead, TH, TR, TD,
  Modal as UiModal, Field as UiField, Input, Textarea, Select, Badge,
} from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/resources/admin")({
  head: () => ({ meta: [{ title: "Manage Resources — Vantage Portal" }, { name: "robots", content: "noindex" }] }),
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
      <PageBody>
        <PageHeader
          title="Manage hub content"
          description="Admin controls for resources, presenters, recordings, and quick links."
          actions={
            <Link to="/portal/resources">
              <Button variant="secondary" size="sm">← Hub</Button>
            </Link>
          }
        />
        <Tabs
          className="mb-4"
          tabs={[
            { value: "resources", label: "Resources" },
            { value: "presenters", label: "Presenters" },
            { value: "recordings", label: "Recordings" },
            { value: "quicklinks", label: "Quick Links" },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === "resources" && <ResourcesAdmin />}
        {tab === "presenters" && <PresentersAdmin />}
        {tab === "recordings" && <RecordingsAdmin />}
        {tab === "quicklinks" && <QuickLinksAdmin />}
      </PageBody>
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
      <div className="mb-3 flex justify-end">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setEditing({ title: "", description: "", long: "", category: "general", type: "guide", url: "", cta: "Open", meta: "", tags: [], display_date: "", position: 0, is_published: true })}
        >
          + New resource
        </Button>
      </div>
      {q.isLoading ? (
        <div className="p-secondary text-center">Loading…</div>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TH>Title</TH><TH>Type</TH><TH>Category</TH><TH>Published</TH><TH align="right" />
            </THead>
            <tbody>
              {(q.data?.resources ?? []).map((r: any) => (
                <TR key={r.id}>
                  <TD className="p-card-title">{r.title}</TD>
                  <TD className="p-secondary uppercase">{r.type}</TD>
                  <TD className="p-secondary">{r.category}</TD>
                  <TD>{r.is_published ? <Badge tone="green">Yes</Badge> : <Badge tone="neutral">No</Badge>}</TD>
                  <TD align="right">
                    <button onClick={() => setEditing(r)} className="p-focus mr-3 p-secondary hover:[color:var(--p-text)]">Edit</button>
                    <button onClick={() => confirm("Delete resource?") && delM.mutate(r.id)} className="p-focus" style={{ color: "var(--p-red)" }}>Delete</button>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      {editing && (
        <UiModal
          title={editing.id ? "Edit resource" : "New resource"}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!editing.title?.trim()}
                onClick={() => saveM.mutate({
                  id: editing.id, title: editing.title,
                  description: editing.description || null, long: editing.long || null,
                  category: editing.category || "general", type: editing.type || "guide",
                  url: editing.url || null, cta: editing.cta || null, meta: editing.meta || null,
                  tags: Array.isArray(editing.tags) ? editing.tags : String(editing.tags || "").split(",").map((s: string) => s.trim()).filter(Boolean),
                  display_date: editing.display_date || null, position: Number(editing.position ?? 0),
                  is_published: !!editing.is_published,
                })}
              >
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <UiField label="Title"><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></UiField>
            <UiField label="Description"><Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></UiField>
            <UiField label="Long description"><Textarea rows={4} value={editing.long ?? ""} onChange={(e) => setEditing({ ...editing, long: e.target.value })} /></UiField>
            <div className="grid grid-cols-2 gap-3">
              <UiField label="Type">
                <Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
                  <option value="video">Video</option><option value="pdf">PDF</option><option value="training">Training</option><option value="guide">Guide</option><option value="course">Course</option>
                </Select>
              </UiField>
              <UiField label="Category"><Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></UiField>
            </div>
            <UiField label="URL"><Input value={editing.url ?? ""} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://…" /></UiField>
            <div className="grid grid-cols-2 gap-3">
              <UiField label="CTA label"><Input value={editing.cta ?? ""} onChange={(e) => setEditing({ ...editing, cta: e.target.value })} placeholder="Open PDF" /></UiField>
              <UiField label="Meta"><Input value={editing.meta ?? ""} onChange={(e) => setEditing({ ...editing, meta: e.target.value })} placeholder="PDF · 3 pages" /></UiField>
            </div>
            <UiField label="Tags (comma-separated)">
              <Input
                value={Array.isArray(editing.tags) ? editing.tags.join(", ") : (editing.tags ?? "")}
                onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
              />
            </UiField>
            <div className="grid grid-cols-3 gap-3">
              <UiField label="Display date"><Input type="date" value={editing.display_date ?? ""} onChange={(e) => setEditing({ ...editing, display_date: e.target.value })} /></UiField>
              <UiField label="Position"><Input type="number" value={editing.position ?? 0} onChange={(e) => setEditing({ ...editing, position: Number(e.target.value) })} /></UiField>
              <label className="p-secondary flex items-end gap-2 pb-2 text-[13px]">
                <input type="checkbox" checked={!!editing.is_published} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} />
                Published
              </label>
            </div>
          </div>
        </UiModal>
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
      <div className="mb-3 flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setEditing({ slug: "", name: "", role: "", initials: "", sort_order: presenters.length + 1, is_active: true })}>
          + New presenter
        </Button>
      </div>
      <TableWrap>
        <Table>
          <THead>
            <TH>Name</TH><TH>Role</TH><TH>Slug</TH><TH>Active</TH><TH align="right" />
          </THead>
          <tbody>
            {presenters.map((p: any) => (
              <TR key={p.id}>
                <TD className="p-card-title">{p.initials} · {p.name}</TD>
                <TD className="p-secondary">{p.role}</TD>
                <TD className="p-muted">{p.slug}</TD>
                <TD>{p.is_active ? <Badge tone="green">Yes</Badge> : <Badge tone="neutral">No</Badge>}</TD>
                <TD align="right">
                  <button onClick={() => setEditing(p)} className="p-focus mr-3 p-secondary hover:[color:var(--p-text)]">Edit</button>
                  <button onClick={() => confirm("Delete presenter and their recordings?") && delM.mutate(p.id)} className="p-focus" style={{ color: "var(--p-red)" }}>Delete</button>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </TableWrap>
      {editing && (
        <UiModal
          title={editing.id ? "Edit presenter" : "New presenter"}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!editing.name?.trim() || !editing.slug?.trim() || !editing.initials?.trim()}
                onClick={() => saveM.mutate({
                  id: editing.id, slug: editing.slug, name: editing.name, role: editing.role || null,
                  initials: editing.initials, sort_order: Number(editing.sort_order ?? 0), is_active: !!editing.is_active,
                })}
              >
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <UiField label="Name"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></UiField>
              <UiField label="Initials"><Input maxLength={3} value={editing.initials} onChange={(e) => setEditing({ ...editing, initials: e.target.value.toUpperCase() })} /></UiField>
            </div>
            <UiField label="Slug"><Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase() })} /></UiField>
            <UiField label="Role"><Input value={editing.role ?? ""} onChange={(e) => setEditing({ ...editing, role: e.target.value })} /></UiField>
            <div className="grid grid-cols-2 gap-3">
              <UiField label="Sort order"><Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></UiField>
              <label className="p-secondary flex items-end gap-2 pb-2 text-[13px]"><input type="checkbox" checked={!!editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />Active</label>
            </div>
          </div>
        </UiModal>
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
      <div className="mb-3 flex justify-end">
        <Button
          variant="primary"
          size="sm"
          disabled={presenters.length === 0}
          onClick={() => setEditing({ presenter_id: presenters[0]?.id, title: "", topic: "", description: "", video_url: "", audio: false, duration: "", recorded_on: "", position: recordings.length + 1, is_published: true })}
        >
          + New recording
        </Button>
      </div>
      <TableWrap>
        <Table>
          <THead>
            <TH>Title</TH><TH>Presenter</TH><TH>Topic</TH><TH>Date</TH><TH align="right" />
          </THead>
          <tbody>
            {recordings.map((r: any) => (
              <TR key={r.id}>
                <TD className="p-card-title">{r.title}</TD>
                <TD className="p-secondary">{nameOf(r.presenter_id)}</TD>
                <TD className="p-secondary">{r.topic}</TD>
                <TD className="p-muted">{r.recorded_on}</TD>
                <TD align="right">
                  <button onClick={() => setEditing(r)} className="p-focus mr-3 p-secondary hover:[color:var(--p-text)]">Edit</button>
                  <button onClick={() => confirm("Delete recording?") && delM.mutate(r.id)} className="p-focus" style={{ color: "var(--p-red)" }}>Delete</button>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </TableWrap>
      {editing && (
        <UiModal
          title={editing.id ? "Edit recording" : "New recording"}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!editing.title?.trim() || !editing.presenter_id}
                onClick={() => saveM.mutate({
                  id: editing.id, presenter_id: editing.presenter_id,
                  title: editing.title, topic: editing.topic || null, description: editing.description || null,
                  video_url: editing.video_url || null, audio: !!editing.audio,
                  duration: editing.duration || null, recorded_on: editing.recorded_on || null,
                  position: Number(editing.position ?? 0), is_published: !!editing.is_published,
                })}
              >
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <UiField label="Presenter">
              <Select value={editing.presenter_id} onChange={(e) => setEditing({ ...editing, presenter_id: e.target.value })}>
                {presenters.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </UiField>
            <UiField label="Title"><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></UiField>
            <div className="grid grid-cols-2 gap-3">
              <UiField label="Topic"><Input value={editing.topic ?? ""} onChange={(e) => setEditing({ ...editing, topic: e.target.value })} /></UiField>
              <UiField label="Duration (mm:ss)"><Input value={editing.duration ?? ""} onChange={(e) => setEditing({ ...editing, duration: e.target.value })} placeholder="12:45" /></UiField>
            </div>
            <UiField label="Description"><Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></UiField>
            <UiField label="Video URL (Google Drive /preview or YouTube embed)">
              <Input value={editing.video_url ?? ""} onChange={(e) => setEditing({ ...editing, video_url: e.target.value })} placeholder="https://drive.google.com/file/d/…/preview" />
            </UiField>
            <div className="grid grid-cols-3 gap-3">
              <UiField label="Recorded on"><Input type="date" value={editing.recorded_on ?? ""} onChange={(e) => setEditing({ ...editing, recorded_on: e.target.value })} /></UiField>
              <UiField label="Position"><Input type="number" value={editing.position ?? 0} onChange={(e) => setEditing({ ...editing, position: Number(e.target.value) })} /></UiField>
              <label className="p-secondary flex items-end gap-2 pb-2 text-[13px]"><input type="checkbox" checked={!!editing.audio} onChange={(e) => setEditing({ ...editing, audio: e.target.checked })} />Audio only</label>
            </div>
            <label className="p-secondary flex items-center gap-2 text-[13px]"><input type="checkbox" checked={!!editing.is_published} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} />Published</label>
          </div>
        </UiModal>
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
      <div className="mb-3 flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setEditing({ label: "", sub: "", url: "", position: links.length + 1, is_active: true })}>
          + New quick link
        </Button>
      </div>
      <TableWrap>
        <Table>
          <THead>
            <TH>Label</TH><TH>Sub</TH><TH>URL</TH><TH align="right" />
          </THead>
          <tbody>
            {links.map((l: any) => (
              <TR key={l.id}>
                <TD className="p-card-title">{l.label}</TD>
                <TD className="p-secondary">{l.sub}</TD>
                <TD className="p-muted max-w-[280px] truncate">{l.url}</TD>
                <TD align="right">
                  <button onClick={() => setEditing(l)} className="p-focus mr-3 p-secondary hover:[color:var(--p-text)]">Edit</button>
                  <button onClick={() => confirm("Delete link?") && delM.mutate(l.id)} className="p-focus" style={{ color: "var(--p-red)" }}>Delete</button>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </TableWrap>
      {editing && (
        <UiModal
          title={editing.id ? "Edit quick link" : "New quick link"}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!editing.label?.trim() || !editing.url?.trim()}
                onClick={() => saveM.mutate({
                  id: editing.id, label: editing.label, sub: editing.sub || null,
                  url: editing.url, position: Number(editing.position ?? 0), is_active: !!editing.is_active,
                })}
              >
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <UiField label="Label"><Input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} /></UiField>
            <UiField label="Subtitle"><Input value={editing.sub ?? ""} onChange={(e) => setEditing({ ...editing, sub: e.target.value })} /></UiField>
            <UiField label="URL"><Input value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} /></UiField>
            <div className="grid grid-cols-2 gap-3">
              <UiField label="Position"><Input type="number" value={editing.position ?? 0} onChange={(e) => setEditing({ ...editing, position: Number(e.target.value) })} /></UiField>
              <label className="p-secondary flex items-end gap-2 pb-2 text-[13px]"><input type="checkbox" checked={!!editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />Active</label>
            </div>
          </div>
        </UiModal>
      )}
    </div>
  );
}
