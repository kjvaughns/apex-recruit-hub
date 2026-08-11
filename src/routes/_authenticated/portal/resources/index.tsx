import { createFileRoute, redirect } from "@tanstack/react-router";

// Resources became Vantage Academy. Redirect to preserve links/bookmarks.
export const Route = createFileRoute("/_authenticated/portal/resources/")({
  beforeLoad: () => {
    throw redirect({ to: "/portal/academy" });
  },
});
