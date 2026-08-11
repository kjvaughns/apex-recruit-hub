import { createFileRoute, Link } from "@tanstack/react-router";
import { PortalShell } from "@/components/vantage/portal-shell";
import { PageBody, Panel, Button, Badge } from "@/components/portal/ui";
import { ChevronLeft, Video, Headphones, FileText, Link2, Download, ExternalLink, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/academy/library/$slug")({
  head: () => ({ meta: [{ title: "Resource — Vantage Academy" }, { name: "robots", content: "noindex" }] }),
  component: ResourceDetail,
});

type ResType = "video" | "audio" | "file" | "link";

/* ---- Phase 0 mock (Phase 4 wires real query by slug) ---- */
const MOCK = {
  title: "Needs Analysis Script",
  description:
    "The full discovery script for first appointments — question flow, transitions, and the close.",
  type: "file" as ResType,
  tags: ["Scripts", "Appointments"],
  required: true,
  url: "#",
};

const TYPE_ICON: Record<ResType, typeof Video> = { video: Video, audio: Headphones, file: FileText, link: Link2 };

function ResourceDetail() {
  const { slug } = Route.useParams();
  const r = MOCK;
  const Icon = TYPE_ICON[r.type];

  return (
    <PortalShell>
      <PageBody>
        <Link to="/portal/academy" className="p-focus mb-4 inline-flex items-center gap-1 text-[13px]" style={{ color: "var(--p-text-2)" }}>
          <ChevronLeft size={15} /> Academy
        </Link>

        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-[10px]" style={{ background: "var(--p-raised)", color: "var(--p-gold)" }}>
                <Icon size={18} />
              </span>
              <div>
                <h1 className="p-title">{r.title}</h1>
                <div className="p-muted mt-0.5 capitalize">{r.type} · {slug}</div>
              </div>
            </div>
            {r.required && <Badge tone="gold">Required</Badge>}
          </div>

          {/* Per-type body */}
          {r.type === "video" && (
            <div className="p-panel grid aspect-video w-full place-items-center" style={{ background: "var(--p-raised)" }}>
              <PlayCircle size={48} style={{ color: "var(--p-text-3)" }} />
            </div>
          )}
          {r.type === "audio" && (
            <Panel><div className="flex items-center gap-3"><Headphones size={20} style={{ color: "var(--p-gold)" }} /><span className="p-secondary">Audio player renders here.</span></div></Panel>
          )}
          {r.type === "file" && (
            <Panel
              title="Preview"
              actions={<Button variant="primary" size="sm"><Download size={14} /> Download</Button>}
            >
              <div className="grid h-64 w-full place-items-center rounded-[10px]" style={{ background: "var(--p-raised)", color: "var(--p-text-3)" }}>
                Embedded file preview
              </div>
            </Panel>
          )}
          {r.type === "link" && (
            <Panel>
              <p className="p-secondary mb-3">{r.description}</p>
              <a href={r.url} target="_blank" rel="noreferrer noopener" className={"p-focus inline-flex items-center gap-1.5 rounded-[10px] px-3.5 text-[13.5px] font-semibold h-[36px] border-transparent text-[#0B0B0C]"} style={{ background: "var(--p-gold)" }}>
                <ExternalLink size={14} /> Open
              </a>
            </Panel>
          )}

          {r.type !== "link" && <p className="p-secondary leading-relaxed">{r.description}</p>}

          <div className="flex flex-wrap gap-1.5">
            {r.tags.map((t) => (
              <Badge key={t} tone="neutral">{t}</Badge>
            ))}
          </div>
        </div>
      </PageBody>
    </PortalShell>
  );
}
