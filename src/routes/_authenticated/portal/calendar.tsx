import { createFileRoute } from "@tanstack/react-router";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";

export const Route = createFileRoute("/_authenticated/portal/calendar")({
  head: () => ({ meta: [{ title: "Calendar — APEX Portal" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <PortalShell>
      <PortalHeader kicker="Coming soon" title="Calendar" />
      <div className="px-6 py-16 md:px-10 text-center text-apex-dim">Calendar integration launches in the next release.</div>
    </PortalShell>
  ),
});
