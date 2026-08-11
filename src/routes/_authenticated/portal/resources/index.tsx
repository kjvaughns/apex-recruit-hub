import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PortalShell } from "@/components/vantage/portal-shell";
import { getResourceHub } from "@/lib/resources.functions";
import { getMe } from "@/lib/portal.functions";
import { PageHeader, PageBody, TableWrap, Table, THead, TH, TR, TD, Panel, Button } from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/portal/resources/")({
  head: () => ({ meta: [{ title: "Resources — Vantage Portal" }, { name: "robots", content: "noindex" }] }),
  component: HubPage,
});

const HUB = [
  {
    to: "/portal/resources/presentations" as const,
    label: "Recorded Trainings",
    desc: "Watch and listen to recorded calls and trainings from the team — with a built-in transcript for every session.",
  },
  {
    to: "/portal/resources/library" as const,
    label: "Resource Library",
    desc: "Scripts, carrier guides, trainings, and PDFs — searchable and filterable by type.",
  },
];

function HubPage() {
  const hubFn = useServerFn(getResourceHub);
  const meFn = useServerFn(getMe);
  const hubQ = useQuery({ queryKey: ["resource-hub"], queryFn: () => hubFn() });
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const isAdmin = (meQ.data?.roles ?? []).some((r) => r === "admin" || r === "super_admin");

  const meta: Record<string, string> = {
    "/portal/resources/presentations": `${hubQ.data?.presenterCount ?? 0} presenters · ${hubQ.data?.recordingCount ?? 0} recordings`,
    "/portal/resources/library": `${hubQ.data?.resourceCount ?? 0} resources`,
  };
  const quickLinks = hubQ.data?.quickLinks ?? [];

  return (
    <PortalShell>
      <PageBody>
        <PageHeader
          title="Resources"
          description="Recordings, trainings, scripts, and tools — curated for Vantage agents and updated weekly."
          actions={
            isAdmin && (
              <Link to="/portal/resources/admin">
                <Button variant="secondary" size="sm">⚙ Manage hub content</Button>
              </Link>
            )
          }
        />

        <TableWrap className="mb-4">
          <Table>
            <THead>
              <TH>Area</TH>
              <TH>Description</TH>
              <TH>Contents</TH>
              <TH align="right" />
            </THead>
            <tbody>
              {HUB.map((h) => (
                <TR key={h.to}>
                  <TD className="p-card-title">{h.label}</TD>
                  <TD className="p-secondary max-w-[420px]">{h.desc}</TD>
                  <TD className="p-muted whitespace-nowrap">{meta[h.to]}</TD>
                  <TD align="right">
                    <Link to={h.to} className="p-focus text-[13px] font-semibold" style={{ color: "var(--p-gold)" }}>
                      Open →
                    </Link>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>

        {quickLinks.length > 0 && (
          <Panel title="Quick links">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {quickLinks.map((l) => (
                <a
                  key={l.id}
                  href={l.url}
                  target={l.url?.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className="p-panel flex flex-col gap-0.5 p-3 transition hover:[border-color:var(--p-border-strong)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="p-card-title truncate">{l.label}</span>
                    <span style={{ color: "var(--p-gold)" }}>↗</span>
                  </div>
                  {l.sub && <span className="p-muted truncate">{l.sub}</span>}
                </a>
              ))}
            </div>
          </Panel>
        )}
      </PageBody>
    </PortalShell>
  );
}
