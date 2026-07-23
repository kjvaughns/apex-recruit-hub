import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getMe } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/portal/admin")({
  beforeLoad: async () => {
    const me = await getMe();
    const roles = me?.roles ?? [];
    if (!roles.some((r: string) => r === "admin" || r === "super_admin")) {
      throw redirect({ to: "/portal" });
    }
  },
  component: () => <Outlet />,
});
