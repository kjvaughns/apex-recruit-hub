import { createFileRoute } from "@tanstack/react-router";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";

export const Route = createFileRoute("/_authenticated/portal/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — APEX Portal" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <PortalShell>
      <PortalHeader kicker="Performance" title="Leaderboard" />
      <div className="px-6 py-16 md:px-10 text-center text-apex-dim">Leaderboard launches in the next release.</div>
    </PortalShell>
  ),
});
