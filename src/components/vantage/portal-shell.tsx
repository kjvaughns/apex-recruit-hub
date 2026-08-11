import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { VantageLogo } from "@/components/vantage/brand";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe, addAgent, getMyOnboarding } from "@/lib/portal.functions";
import { AddAgentModal } from "@/components/vantage/add-agent-modal";
import { useTheme } from "@/components/vantage/theme";
import { Avatar, Badge, btnClass } from "@/components/portal/ui";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Trophy,
  BookOpen,
  Network,
  Settings,
  Rocket,
  UserPlus,
  Mail,
  ShieldCheck,
  ScrollText,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  type LucideIcon,
} from "lucide-react";

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { to: "/portal/applicants", label: "Applicants", icon: Users },
  { to: "/portal/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/portal/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/portal/resources", label: "Resources", icon: BookOpen },
  { to: "/portal/organization", label: "Organization", icon: Network },
  { to: "/portal/settings", label: "My Settings", icon: Settings },
];


const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  leader: "Leader",
  agent: "Agent",
};

/** Compact sidebar row. Active state is a subtle gold tint — no heavy outline. */
function NavRow({
  to,
  icon: Icon,
  label,
  active,
  collapsed,
  onClick,
  accent,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
  accent?: boolean;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`p-focus mb-0.5 flex h-[38px] items-center gap-2.5 rounded-[8px] px-2.5 text-[14px] font-medium transition ${
        collapsed ? "justify-center" : ""
      } ${active ? "" : "hover:bg-[var(--p-hover)]"}`}
      style={
        active
          ? { background: "var(--p-gold-soft)", color: "var(--p-gold)" }
          : { color: accent ? "var(--p-gold)" : "var(--p-text-2)" }
      }
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}


function GroupLabel({ children, hidden }: { children: ReactNode; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <div
      className="mt-4 mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em]"
      style={{ color: "var(--p-text-3)" }}
    >
      {children}
    </div>
  );
}

export function PortalShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { theme, toggle: toggleTheme } = useTheme();

  // Persist sidebar collapse across navigations/reloads.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("vantage_sidebar_collapsed") === "1") setCollapsed(true);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined")
      localStorage.setItem("vantage_sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const fetchMe = useServerFn(getMe);
  const addAgentFn = useServerFn(addAgent);
  const fetchOnboarding = useServerFn(getMyOnboarding);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const onboardingQ = useQuery({ queryKey: ["my-onboarding"], queryFn: () => fetchOnboarding() });
  const showOnboardingNav = !!onboardingQ.data?.hasOnboarding && !onboardingQ.data.complete;

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
  const primaryRole =
    roles.find((r) => r === "super_admin") ??
    roles.find((r) => r === "admin") ??
    roles.find((r) => r === "manager") ??
    roles.find((r) => r === "leader") ??
    roles[0];

  const current =
    [...NAV]
      .sort((a, b) => b.to.length - a.to.length)
      .find((n) => (n.to === "/portal" ? path === "/portal" : path.startsWith(n.to)))?.label ??
    (path.startsWith("/portal/admin")
      ? "Admin"
      : path.startsWith("/portal/invitations")
        ? "Invitations"
        : path.startsWith("/portal/onboarding")
          ? "Onboarding"
          : "Portal");

  return (
    <div
      className={`vantage-portal relative min-h-screen ${theme === "light" ? "vantage-theme-light" : ""}`}
      style={{ background: "var(--p-bg)", color: "var(--p-text)" }}
    >
      <div className="relative flex">
        {/* Sidebar */}
        <aside
          className={`${mobileOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex ${
            collapsed ? "w-[64px]" : "w-[240px]"
          } flex-col border-r transition-[width,transform] md:sticky md:top-0 md:h-screen md:translate-x-0`}
          style={{ background: "var(--p-sidebar)", borderColor: "var(--p-border)" }}
        >
          <div
            className={`flex h-[56px] shrink-0 items-center gap-2 border-b ${collapsed ? "justify-center px-2" : "px-4"}`}
            style={{ borderColor: "var(--p-border)" }}
          >
            <VantageLogo className="vantage-brand-mark h-7 w-auto" />
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-3">
            {showOnboardingNav && (
              <NavRow
                to="/portal/onboarding"
                icon={Rocket}
                label="Onboarding"
                accent
                active={path.startsWith("/portal/onboarding")}
                collapsed={collapsed}
                onClick={() => setMobileOpen(false)}
              />
            )}
            {NAV.map((n) => (
              <NavRow
                key={n.to}
                to={n.to}
                icon={n.icon}
                label={n.label}
                active={n.to === "/portal" ? path === "/portal" : path.startsWith(n.to)}
                collapsed={collapsed}
                onClick={() => setMobileOpen(false)}
              />
            ))}

            {canInvite && (
              <>
                <GroupLabel hidden={collapsed}>Management</GroupLabel>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    setAddAgentOpen(true);
                  }}
                  title={collapsed ? "Add Agent" : undefined}
                  className={`p-focus mb-0.5 flex h-[38px] w-full items-center gap-2.5 rounded-[8px] px-2.5 text-[14px] font-medium transition hover:bg-[var(--p-hover)] ${
                    collapsed ? "justify-center" : ""
                  }`}
                  style={{ color: "var(--p-gold)" }}
                >
                  <UserPlus className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  {!collapsed && <span>Add Agent</span>}
                </button>
                <NavRow
                  to="/portal/invitations"
                  icon={Mail}
                  label="Invitations"
                  active={path.startsWith("/portal/invitations")}
                  collapsed={collapsed}
                  onClick={() => setMobileOpen(false)}
                />
              </>
            )}

            {isAdmin && (
              <>
                <GroupLabel hidden={collapsed}>Admin</GroupLabel>
                <NavRow
                  to="/portal/admin"
                  icon={ShieldCheck}
                  label="Admin"
                  active={
                    path.startsWith("/portal/admin") && !path.startsWith("/portal/admin/audit")
                  }
                  collapsed={collapsed}
                  onClick={() => setMobileOpen(false)}
                />
                <NavRow
                  to="/portal/admin/audit"
                  icon={ScrollText}
                  label="Audit Log"
                  active={path.startsWith("/portal/admin/audit")}
                  collapsed={collapsed}
                  onClick={() => setMobileOpen(false)}
                />
              </>
            )}
          </nav>

          <div className="shrink-0 border-t p-2" style={{ borderColor: "var(--p-border)" }}>
            <div
              className={`flex items-center gap-2.5 rounded-[8px] px-1.5 py-2 ${collapsed ? "justify-center" : ""}`}
            >
              <Avatar name={displayName} email={profile?.email} size={30} />
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{displayName}</div>
                  <div className="truncate text-[11.5px]" style={{ color: "var(--p-text-3)" }}>
                    {profile?.email}
                  </div>
                </div>
              )}
            </div>

            {!collapsed && (
              <button onClick={signOut} className={`${btnClass("secondary", "sm")} mt-1 w-full`}>
                Sign out
              </button>
            )}
          </div>
        </aside>

        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header
            className="sticky top-0 z-30 flex h-[56px] shrink-0 items-center gap-3 border-b px-3 backdrop-blur-xl md:px-6"
            style={{
              borderColor: "var(--p-border)",
              background: "color-mix(in oklab, var(--p-bg) 88%, transparent)",
            }}
          >
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation"
              className={`${btnClass("ghost", "sm")} md:hidden`}
            >
              ☰
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold">{current}</div>
            </div>
            {primaryRole && (
              <Badge tone="neutral" className="hidden sm:inline-flex">
                {ROLE_LABEL[primaryRole] ?? primaryRole}
              </Badge>
            )}
            {canInvite && (
              <button
                onClick={() => setAddAgentOpen(true)}
                className={`${btnClass("primary", "sm")} hidden sm:inline-flex`}
              >
                ＋ Add Agent
              </button>
            )}
            <Avatar name={displayName} email={profile?.email} size={28} />
          </header>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
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

/**
 * Legacy page header kept for API compatibility with existing routes. Restyled
 * as a compact operational header (no oversized display type, no gold kicker).
 */
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
    <div className="px-4 pt-5 pb-1 md:px-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="p-title truncate">{title}</h1>
          {kicker && (
            <div className="p-secondary mt-1 truncate">
              {kicker.charAt(0) + kicker.slice(1).toLowerCase()}
            </div>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
