import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ApexLogo } from "@/components/apex/brand";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe, addAgent } from "@/lib/portal.functions";
import { AddAgentModal } from "@/components/apex/add-agent-modal";

const NAV = [
  { to: "/portal", label: "Dashboard", icon: "◈" },
  { to: "/portal/crm", label: "CRM", icon: "◐" },
  { to: "/portal/pipeline", label: "Pipeline", icon: "▤" },
  { to: "/portal/tasks", label: "Tasks", icon: "✓" },
  { to: "/portal/calendar", label: "Calendar", icon: "◗" },
  { to: "/portal/leaderboard", label: "Leaderboard", icon: "★" },
  { to: "/portal/resources", label: "Resources", icon: "▤" },
  { to: "/portal/organization", label: "Organization", icon: "⚇" },
  { to: "/portal/settings", label: "My Settings", icon: "⚙" },
];

export function PortalShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchMe = useServerFn(getMe);
  const addAgentFn = useServerFn(addAgent);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate({ to: "/login", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const profile = meQ.data?.profile;
  const roles = meQ.data?.roles ?? [];
  const isAdmin = roles.some((r) => r === "admin" || r === "super_admin");
  const isManager = roles.includes("manager");
  const isLeader = roles.includes("leader");
  const canInvite =
    isAdmin ||
    isManager ||
    (isLeader && (!!profile?.can_invite_agents || !!profile?.can_invite_leaders));
  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.email ||
    "Agent";
  const initials =
    ((profile?.first_name?.[0] ?? "") + (profile?.last_name?.[0] ?? "")).toUpperCase() || "A";

  return (
    <div className="relative min-h-screen bg-black text-apex-ivory">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[360px] bg-[radial-gradient(circle_at_50%_-20%,rgba(201,168,76,0.10),transparent_70%)]" />

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/[0.06] bg-black/70 px-4 py-3 backdrop-blur-xl md:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="apx-btn-ghost px-3 py-2 text-sm"
        >
          ☰
        </button>
        <ApexLogo className="h-7 w-auto" />
        <div className="h-8 w-8 rounded-full bg-apex-gold/15 text-center leading-8 font-display text-apex-gold">
          {initials}
        </div>
      </div>

      <div className="relative flex">
        {/* Sidebar */}
        <aside
          className={`${mobileOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex ${collapsed ? "w-[72px]" : "w-[248px]"} flex-col border-r border-white/[0.06] bg-[#050505]/95 backdrop-blur-2xl transition-all md:sticky md:top-0 md:h-screen md:translate-x-0`}
        >
          <div className="flex h-[76px] items-center gap-3 border-b border-white/[0.06] px-5">
            <ApexLogo className={collapsed ? "h-8 w-auto" : "h-9 w-auto"} />
            {!collapsed && (
              <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.22em] text-apex-gold">
                Portal
              </span>
            )}
          </div>
          <nav className="flex-1 overflow-y-auto p-3">
            {NAV.map((n) => {
              const active = n.to === "/portal" ? path === "/portal" : path.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setMobileOpen(false)}
                  className={`mb-1 flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] font-medium transition ${
                    active
                      ? "bg-apex-gold/10 text-apex-gold border border-apex-gold/25"
                      : "border border-transparent text-apex-dim hover:bg-white/[0.03] hover:text-apex-ivory"
                  }`}
                >
                  <span className="w-5 text-center text-[15px]">{n.icon}</span>
                  {!collapsed && <span>{n.label}</span>}
                </Link>
              );
            })}
            {canInvite && (
              <>
                <div
                  className={`mt-5 mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-apex-faint ${collapsed && "hidden"}`}
                >
                  Management
                </div>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    setAddAgentOpen(true);
                  }}
                  className="mb-1 flex w-full items-center gap-3 rounded-[10px] border border-apex-gold/25 bg-apex-gold/[0.06] px-3 py-2.5 text-[14px] font-medium text-apex-gold transition hover:bg-apex-gold/[0.12]"
                >
                  <span className="w-5 text-center">＋</span>
                  {!collapsed && <span>Add Agent</span>}
                </button>
                <Link
                  to="/portal/invitations"
                  onClick={() => setMobileOpen(false)}
                  className={`mb-1 flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] font-medium transition ${
                    path.startsWith("/portal/invitations")
                      ? "bg-apex-gold/10 text-apex-gold border border-apex-gold/25"
                      : "border border-transparent text-apex-dim hover:bg-white/[0.03] hover:text-apex-ivory"
                  }`}
                >
                  <span className="w-5 text-center">✉</span>
                  {!collapsed && <span>Invitations</span>}
                </Link>
              </>
            )}
            {isAdmin && (
              <>
                <div
                  className={`mt-5 mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-apex-faint ${collapsed && "hidden"}`}
                >
                  Admin
                </div>
                <Link
                  to="/portal/admin"
                  onClick={() => setMobileOpen(false)}
                  className={`mb-1 flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] font-medium transition ${
                    path.startsWith("/portal/admin")
                      ? "bg-apex-gold/10 text-apex-gold border border-apex-gold/25"
                      : "border border-transparent text-apex-dim hover:bg-white/[0.03] hover:text-apex-ivory"
                  }`}
                >
                  <span className="w-5 text-center">⚙</span>
                  {!collapsed && <span>Admin</span>}
                </Link>
                <Link
                  to="/portal/admin/audit"
                  onClick={() => setMobileOpen(false)}
                  className={`mb-1 flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] font-medium transition ${
                    path.startsWith("/portal/admin/audit")
                      ? "bg-apex-gold/10 text-apex-gold border border-apex-gold/25"
                      : "border border-transparent text-apex-dim hover:bg-white/[0.03] hover:text-apex-ivory"
                  }`}
                >
                  <span className="w-5 text-center">◫</span>
                  {!collapsed && <span>Audit Log</span>}
                </Link>
              </>
            )}
          </nav>
          <div className="border-t border-white/[0.06] p-3">
            <div
              className={`flex items-center gap-3 rounded-[10px] p-2 ${collapsed ? "justify-center" : ""}`}
            >
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-apex-gold/15 font-display text-apex-gold">
                {initials}
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-apex-ivory">
                    {displayName}
                  </div>
                  <div className="truncate text-[11.5px] text-apex-faint">{profile?.email}</div>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={signOut}
                className="mt-2 w-full rounded-[10px] border border-white/10 px-3 py-2 text-[12.5px] text-apex-dim transition hover:border-apex-gold/30 hover:text-apex-ivory"
              >
                Sign out
              </button>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="mt-2 hidden w-full rounded-[10px] border border-white/[0.06] px-3 py-1.5 text-[11px] text-apex-faint hover:border-white/20 md:block"
            >
              {collapsed ? "→" : "← Collapse"}
            </button>
          </div>
        </aside>

        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/70 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {addAgentOpen && (
        <AddAgentModal
          onClose={() => setAddAgentOpen(false)}
          onSubmit={async (fields) => {
            const res = await addAgentFn({ data: fields });
            setAddAgentOpen(false);
            qc.invalidateQueries({ queryKey: ["applicants"] });
            toast.success("Agent added — onboarding invite sent.", {
              action: {
                label: "View record",
                onClick: () =>
                  navigate({ to: "/portal/crm/$applicantId", params: { applicantId: res.id } }),
              },
            });
          }}
        />
      )}
    </div>
  );
}

export function PortalHeader({
  title,
  kicker,
  actions,
}: {
  title: string;
  kicker?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-white/[0.06] bg-black/40 px-6 pt-8 pb-6 backdrop-blur-md md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {kicker && <div className="apx-kicker mb-2">{kicker}</div>}
          <h1 className="font-display text-[clamp(28px,4vw,44px)] leading-none">{title}</h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
