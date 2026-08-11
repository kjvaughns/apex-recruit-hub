import { createFileRoute, redirect } from "@tanstack/react-router";

// Resource admin became the Academy builder.
export const Route = createFileRoute("/_authenticated/portal/resources/admin")({
  beforeLoad: () => {
    throw redirect({ to: "/portal/academy/admin" });
  },
});
