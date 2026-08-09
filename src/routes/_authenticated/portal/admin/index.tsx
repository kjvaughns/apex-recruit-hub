import { createFileRoute, Link } from "@tanstack/react-router";
import { PortalShell, PortalHeader } from "@/components/apex/portal-shell";

export const Route = createFileRoute("/_authenticated/portal/admin/")({
  head: () => ({ meta: [{ title: "Admin — Vantage Portal" }, { name: "robots", content: "noindex" }] }),
  component: AdminHome,
});

const CARDS: { to: "/portal/admin/users" | "/portal/admin/stages" | "/portal/admin/settings"; label: string; desc: string; icon: string }[] = [
  { to: "/portal/admin/users", label: "Users & Roles", desc: "Grant admin, manager, or agent access; toggle activation and teams.", icon: "◐" },
  { to: "/portal/admin/stages", label: "Pipeline Stages", desc: "Configure the recruiting pipeline stages, colors, and order.", icon: "▤" },
  { to: "/portal/admin/settings", label: "System Settings", desc: "Global platform configuration and defaults.", icon: "⚙" },
];

function AdminHome() {
  return (
    <PortalShell>
      <PortalHeader kicker="Admin" title="Platform controls" />
      <div className="px-6 py-8 md:px-10">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {CARDS.map((c) => (
            <Link key={c.to} to={c.to} className="apx-card group p-6 transition hover:border-apex-gold/40">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-apex-gold/10 text-apex-gold">{c.icon}</div>
                <div className="font-display text-[22px] text-apex-ivory">{c.label}</div>
              </div>
              <p className="mt-3 text-[14px] leading-relaxed text-apex-dim">{c.desc}</p>
              <div className="mt-4 text-[13px] font-semibold text-apex-gold group-hover:translate-x-0.5 transition">Manage →</div>
            </Link>
          ))}
        </div>
      </div>
    </PortalShell>
  );
}
