import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { PageBody, Panel, Button, Badge, EmptyState } from "@/components/portal/ui";
import { getLibraryResource } from "@/lib/academy.functions";
import { ChevronLeft, Video, Headphones, FileText, Link2, Download, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/academy/library/$slug")({
  head: () => ({ meta: [{ title: "Resource — Vantage Academy" }, { name: "robots", content: "noindex" }] }),
  component: ResourceDetail,
});

type ResType = "video" | "audio" | "file" | "link";
const TYPE_ICON: Record<ResType, typeof Video> = { video: Video, audio: Headphones, file: FileText, link: Link2 };

function ResourceDetail() {
  const { slug } = Route.useParams();
  const getFn = useServerFn(getLibraryResource);
  const q = useQuery({ queryKey: ["academy", "resource", slug], queryFn: () => getFn({ data: { slug } }) });

  if (q.isLoading) return <PortalShell><PageBody><div className="p-secondary">Loading…</div></PageBody></PortalShell>;
  if (!q.data?.found) {
    return (
      <PortalShell>
        <PageBody>
          <EmptyState title="Resource not found" description="This resource may have been removed." action={<Link to="/portal/academy"><Button variant="secondary" size="sm">Back to Academy</Button></Link>} />
        </PageBody>
      </PortalShell>
    );
  }

  const r = q.data.resource as any;
  const Icon = TYPE_ICON[(r.type as ResType) in TYPE_ICON ? (r.type as ResType) : "link"];

  return (
    <PortalShell>
      <PageBody>
        <Link to="/portal/academy" className="p-focus mb-4 inline-flex items-center gap-1 text-[13px]" style={{ color: "var(--p-text-2)" }}>
          <ChevronLeft size={15} /> Academy
        </Link>

        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-[10px]" style={{ background: "var(--p-raised)", color: "var(--p-gold)" }}><Icon size={18} /></span>
              <div>
                <h1 className="p-title">{r.title}</h1>
                <div className="p-muted mt-0.5 capitalize">{r.type}</div>
              </div>
            </div>
            {r.is_required && <Badge tone="gold">Required</Badge>}
          </div>

          {r.type === "video" && (
            <div className="p-panel overflow-hidden">
              {r.url ? <video controls src={r.url} className="aspect-video w-full bg-black" /> : <div className="grid aspect-video place-items-center" style={{ background: "var(--p-raised)", color: "var(--p-text-3)" }}>No media</div>}
            </div>
          )}
          {r.type === "audio" && (
            <Panel>{r.url ? <audio controls src={r.url} className="w-full" /> : <span className="p-muted">No media.</span>}</Panel>
          )}
          {r.type === "file" && (
            <Panel title="File" actions={r.url && <a href={r.url} target="_blank" rel="noreferrer noopener" className="p-focus inline-flex h-8 items-center gap-1.5 rounded-[10px] px-3.5 text-[13px] font-semibold text-[#0B0B0C]" style={{ background: "var(--p-gold)" }}><Download size={14} /> Download</a>}>
              {r.url ? (
                <iframe src={r.url} title={r.title} className="h-[60vh] w-full rounded-[10px]" style={{ background: "var(--p-raised)" }} />
              ) : (
                <div className="p-muted">No file attached.</div>
              )}
            </Panel>
          )}
          {r.type === "link" && (
            <Panel>
              {r.description && <p className="p-secondary mb-3">{r.description}</p>}
              {r.url && (
                <a href={r.url} target="_blank" rel="noreferrer noopener" className="p-focus inline-flex h-[36px] items-center gap-1.5 rounded-[10px] px-3.5 text-[13.5px] font-semibold text-[#0B0B0C]" style={{ background: "var(--p-gold)" }}>
                  <ExternalLink size={14} /> Open
                </a>
              )}
            </Panel>
          )}

          {r.type !== "link" && r.description && <p className="p-secondary leading-relaxed">{r.description}</p>}

          {(r.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(r.tags ?? []).map((t: string) => <Badge key={t} tone="neutral">{t}</Badge>)}
            </div>
          )}
        </div>
      </PageBody>
    </PortalShell>
  );
}
