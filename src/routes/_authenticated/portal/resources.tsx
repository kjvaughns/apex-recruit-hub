import { createFileRoute } from "@tanstack/react-router";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";

export const Route = createFileRoute("/_authenticated/portal/resources")({
  head: () => ({ meta: [{ title: "Resources — APEX Portal" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <PortalShell>
      <PortalHeader kicker="Training" title="Resources" />
      <div className="px-6 py-16 md:px-10 text-center text-apex-dim">Resource library launches in the next release.</div>
    </PortalShell>
  ),
});
