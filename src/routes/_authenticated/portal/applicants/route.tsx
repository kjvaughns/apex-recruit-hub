import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/portal/applicants")({
  component: () => <Outlet />,
});
